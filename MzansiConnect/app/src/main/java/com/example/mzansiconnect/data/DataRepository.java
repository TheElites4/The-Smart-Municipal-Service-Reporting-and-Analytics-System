package com.example.mzansiconnect.data;

import android.content.Context;
import android.util.Log;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.SetOptions;
import com.example.mzansiconnect.util.Gamification;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.UUID;
import android.os.Handler;
import android.os.Looper;

/** Coordinates PostgreSQL-backed report operations, the Room display cache, and optional Firebase services. */
public class DataRepository {
    public interface ReportSubmissionCallback {
        void onSuccess(Map<String, Object> report);
        void onFailure(String message);
    }
    public interface ReportsRefreshCallback {
        void onSuccess(List<Report> reports);
        void onFailure(String message);
    }

    public interface RegistrationCallback {
        void onSuccess();
        void onFailure(String message);
    }
    private static DataRepository instance;
    private final Context context;
    private final AppDatabase sqlDb;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private DataRepository(Context context) {
        this.context = context.getApplicationContext();
        sqlDb = AppDatabase.getInstance(context);
    }

    public static synchronized DataRepository getInstance(Context context) {
        if (instance == null) {
            instance = new DataRepository(context.getApplicationContext());
        }
        return instance;
    }

    public void registerUser(User user, String password) {
        registerUser(user, password, null);
    }

    public void registerUser(User user, String password, RegistrationCallback callback) {
        // 1. SAVE TO LOCAL SQL
        executor.execute(() -> sqlDb.appDao().registerUser(user));

        // 2. SYNC TO FIREBASE AUTH & FIRESTORE
        FirebaseManager fm = FirebaseManager.getInstance();
        if (fm.getAuth() != null) {
            fm.getAuth().createUserWithEmailAndPassword(user.email, password)
                    .addOnSuccessListener(authResult -> {
                        if (authResult.getUser() != null) {
                            String uid = authResult.getUser().getUid();
                            if (fm.getFirestore() != null) {
                                fm.getFirestore().collection("users")
                                        .document(uid).set(user);
                            }
                            syncFcmTokenToFirebase();
                            syncUserToSharedApi(user, uid, callback);
                        }
                    })
                    .addOnFailureListener(e -> {
                        Log.e("DataRepo", "Firebase Auth Failed: " + e.getMessage());
                        if (callback != null) callback.onFailure("Registration failed: " + e.getLocalizedMessage());
                    });
        } else if (callback != null) {
            callback.onFailure("Authentication service is unavailable.");
        }
    }

    public void syncFcmTokenToFirebase() {
        FirebaseManager fm = FirebaseManager.getInstance();
        FirebaseUser currentUser = fm.getCurrentUser();
        if (currentUser == null) return;

        fm.fetchFcmToken(new FirebaseManager.FcmTokenCallback() {
            @Override
            public void onTokenReceived(String token) {
                String uid = currentUser.getUid();
                if (fm.getFirestore() != null) {
                    Map<String, Object> data = new HashMap<>();
                    data.put("fcmToken", token);
                    data.put("lastUpdated", System.currentTimeMillis());
                    fm.getFirestore().collection("users").document(uid)
                            .set(data, SetOptions.merge());
                }
                if (fm.getDatabase() != null) {
                    fm.getDatabase().getReference("user_tokens").child(uid).setValue(token);
                }
            }

            @Override
            public void onError(Exception e) {
                Log.e("DataRepo", "Failed to sync FCM token: " + e.getMessage());
            }
        });
    }

    /** Returns the stable citizen reference shared with the PostgreSQL API. */
    public String getOrCreateExternalRef() {
        android.content.SharedPreferences prefs =
                context.getSharedPreferences("mzansi_client", Context.MODE_PRIVATE);
        String ref = prefs.getString("externalRef", null);
        if (ref == null) {
            ref = UUID.randomUUID().toString();
            prefs.edit().putString("externalRef", ref).apply();
        }
        return ref;
    }

    /** Returns the cached PostgreSQL citizen id, if identity resolution has run before. */
    public String getCachedCitizenId() {
        return context.getSharedPreferences("mzansi_client", Context.MODE_PRIVATE)
                .getString("citizenId", null);
    }

    private void cacheCitizenId(String citizenId) {
        if (citizenId == null || citizenId.isEmpty() || "null".equals(citizenId)) return;
        context.getSharedPreferences("mzansi_client", Context.MODE_PRIVATE)
                .edit().putString("citizenId", citizenId).apply();
    }

    /** Resolves and caches the citizen identity (id + externalRef) with the API. */
    private void resolveIdentity(Runnable onResolved) {
        Map<String, Object> identity = new HashMap<>();
        identity.put("externalRef", getOrCreateExternalRef());
        SharedApi.service().resolveAnonymous(identity).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    cacheCitizenId(String.valueOf(response.body().get("id")));
                }
                onResolved.run();
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable throwable) {
                onResolved.run();
            }
        });
    }

    /** Submit once to the database-backed API; never report success for a local-only copy. */
    public void submitReport(Report report, Map<String, Object> photo, ReportSubmissionCallback callback) {
        final String externalRef = getOrCreateExternalRef();
        // Make sure the report is attributed to this citizen so the server can fan
        // the live event back to this device, then post it.
        if (getCachedCitizenId() == null) {
            resolveIdentity(() -> postReport(report, photo, callback, externalRef));
            return;
        }
        postReport(report, photo, callback, externalRef);
    }

    private void postReport(Report report, Map<String, Object> photo, ReportSubmissionCallback callback, String externalRef) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("externalRef", externalRef);
        String citizenId = getCachedCitizenId();
        if (citizenId != null) payload.put("citizenId", citizenId);
        payload.put("category", report.category);
        payload.put("description", report.description);
        payload.put("location", report.location);
        payload.put("municipality", report.municipality);
        if (report.latitude != null && report.longitude != null) {
            payload.put("latitude", report.latitude);
            payload.put("longitude", report.longitude);
        }
        payload.put("urgency", report.urgency == null ? "medium" : report.urgency.toLowerCase());
        payload.put("status", "submitted");
        if (photo != null) payload.put("photo", photo);
        SharedApi.service().createReport(payload).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                if (!response.isSuccessful() || response.body() == null) {
                    callback.onFailure("The server rejected this report (HTTP " + response.code() + "). It was not submitted.");
                    return;
                }
                Map<String, Object> saved = response.body();
                if (photo != null && !Boolean.TRUE.equals(saved.get("has_photo"))) {
                    callback.onFailure("The report was saved without its photo. Please retry with the photo selected.");
                    return;
                }
                report.remoteId = String.valueOf(saved.get("id"));
                report.publicReference = String.valueOf(saved.get("public_reference"));
                report.status = String.valueOf(saved.get("status"));
                report.hasPhoto = Boolean.TRUE.equals(saved.get("has_photo"));
                Object createdAt = saved.get("created_at");
                if (createdAt != null) report.timestamp = parseTimestamp(String.valueOf(createdAt));
                Object slaDueAt = saved.get("sla_due_at");
                if (slaDueAt != null) report.slaDueAt = parseTimestamp(String.valueOf(slaDueAt));
                executor.execute(() -> {
                    sqlDb.appDao().submitReport(report);
                    new Handler(Looper.getMainLooper()).post(() -> callback.onSuccess(saved));
                });
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable throwable) {
                Log.e("DataRepo", "Report submission failed", throwable);
                callback.onFailure("Could not reach the service. Check your connection and try again.");
            }
        });
    }

    public void refreshCitizenReports(ReportsRefreshCallback callback) {
        String externalRef = getOrCreateExternalRef();
        Map<String, Object> identity = new HashMap<>();
        identity.put("externalRef", externalRef);
        SharedApi.service().resolveAnonymous(identity).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().get("id") == null) {
                    callback.onFailure("Citizen account is unavailable from the service.");
                    return;
                }
                cacheCitizenId(String.valueOf(response.body().get("id")));
                SharedApi.service().getReports(externalRef).enqueue(new Callback<List<Map<String, Object>>>() {
                    @Override
                    public void onResponse(Call<List<Map<String, Object>>> call, Response<List<Map<String, Object>>> reportsResponse) {
                        if (!reportsResponse.isSuccessful() || reportsResponse.body() == null) {
                            callback.onFailure("Reports could not be loaded from the service.");
                            return;
                        }
                        List<Report> reports = new ArrayList<>();
                        for (Map<String, Object> row : reportsResponse.body()) reports.add(toReport(row));
                        executor.execute(() -> {
                            sqlDb.appDao().clearReports();
                            for (Report report : reports) sqlDb.appDao().submitReport(report);
                            new Handler(Looper.getMainLooper()).post(() -> callback.onSuccess(reports));
                        });
                    }

                    @Override
                    public void onFailure(Call<List<Map<String, Object>>> call, Throwable throwable) {
                        callback.onFailure("Reports could not be loaded. Check your connection.");
                    }
                });
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable throwable) {
                callback.onFailure("Citizen account is unavailable. Check your connection.");
            }
        });
    }

    private static Report toReport(Map<String, Object> row) {
        Report report = new Report();
        report.remoteId = String.valueOf(row.get("id"));
        report.publicReference = String.valueOf(row.get("public_reference"));
        report.category = String.valueOf(row.get("category"));
        report.description = String.valueOf(row.get("description"));
        report.location = String.valueOf(row.get("location_text"));
        report.municipality = String.valueOf(row.get("municipality"));
        report.hasPhoto = Boolean.TRUE.equals(row.get("has_photo"));
        if (row.get("latitude") instanceof Number) report.latitude = ((Number) row.get("latitude")).doubleValue();
        if (row.get("longitude") instanceof Number) report.longitude = ((Number) row.get("longitude")).doubleValue();
        report.urgency = String.valueOf(row.get("urgency"));
        report.status = String.valueOf(row.get("status")).replace('_', '-');
        report.timestamp = parseTimestamp(String.valueOf(row.get("created_at")));
        Object slaDueAt = row.get("sla_due_at");
        if (slaDueAt != null) report.slaDueAt = parseTimestamp(String.valueOf(slaDueAt));
        report.points = Gamification.POINTS_PER_REPORT;
        return report;
    }

    private static long parseTimestamp(String value) {
        try {
            Date parsed = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", Locale.US).parse(value);
            return parsed == null ? 0 : parsed.getTime();
        } catch (java.text.ParseException error) {
            return 0;
        }
    }

    private void syncUserToSharedApi(User user, String externalRef, RegistrationCallback callback) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("fullName", user.fullName);
        payload.put("email", user.email);
        payload.put("phone", user.phoneNumber);
        payload.put("externalRef", externalRef);
        SharedApi.service().registerCitizen(payload).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                if (!response.isSuccessful()) {
                    Log.e("DataRepo", "Shared API user sync failed: " + response.code());
                    if (callback != null) callback.onFailure("Your account was created, but cloud sync is unavailable. Try signing in again.");
                } else if (callback != null) {
                    callback.onSuccess();
                }
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable throwable) {
                Log.e("DataRepo", "Shared API user sync unavailable", throwable);
                if (callback != null) callback.onFailure("Your account was created, but cloud sync is unavailable. Try signing in again.");
            }
        });
    }
}
