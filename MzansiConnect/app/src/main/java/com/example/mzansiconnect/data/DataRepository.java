package com.example.mzansiconnect.data;

import android.content.Context;
import android.util.Log;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.SetOptions;
import java.util.HashMap;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.UUID;

/**
 * PRODUCTION READY - TRIPLE DATABASE REPOSITORY
 * This class orchestrates data between Local SQL (Room) and Cloud sources
 * (Firebase Auth, Firestore, Realtime Database, Cloud Messaging).
 */
public class DataRepository {
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

    public void submitReport(Report report) {
        // 1. SAVE TO LOCAL SQL
        executor.execute(() -> sqlDb.appDao().submitReport(report));

        // 2. SYNC TO CLOUD FEED (Firebase Realtime Database & Firestore)
        FirebaseManager fm = FirebaseManager.getInstance();
        if (fm.getFirestore() != null) {
            fm.getFirestore().collection("reports").add(report);
        }
        if (fm.getDatabase() != null) {
            fm.getDatabase().getReference("live_feed").push().setValue(report);
        }

        FirebaseUser firebaseUser = fm.getCurrentUser();
        {
            Map<String, Object> payload = new HashMap<>();
            String anonymousRef = context.getSharedPreferences("mzansi_client", Context.MODE_PRIVATE).getString("externalRef", null);
            if (anonymousRef == null) {
                anonymousRef = UUID.randomUUID().toString();
                context.getSharedPreferences("mzansi_client", Context.MODE_PRIVATE).edit().putString("externalRef", anonymousRef).apply();
            }
            payload.put("externalRef", firebaseUser == null ? anonymousRef : firebaseUser.getUid());
            payload.put("category", report.category);
            payload.put("description", report.description);
            payload.put("location", report.location);
            payload.put("municipality", report.municipality);
            payload.put("urgency", report.urgency == null ? "medium" : report.urgency.toLowerCase());
            SharedApi.service().submitReport(payload).enqueue(new Callback<Map<String, Object>>() {
                @Override
                public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                    if (!response.isSuccessful()) Log.e("DataRepo", "Shared API report sync failed: " + response.code());
                }

                @Override
                public void onFailure(Call<Map<String, Object>> call, Throwable throwable) {
                    Log.e("DataRepo", "Shared API report sync unavailable", throwable);
                }
            });
        }
        Log.d("MzansiReport", "Report saved to Room and queued for Firebase plus shared API synchronization.");
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

    /**
     * Web parity: returns the citizen's stable external reference, creating one on first use
     * (mirrors `crypto.randomUUID()` stored in web `localStorage.user.externalRef`).
     */
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

    /**
     * Web parity (`App.tsx` handleSubmitReport): ensure a citizen identity exists on the
     * shared API, then POST the report to /api/reports as well as /api/mobile/reports.
     * Failures are non-fatal - the report stays queued in Room.
     */
    public void submitReportWebParity(Report report) {
        executor.execute(() -> sqlDb.appDao().submitReport(report));

        final String externalRef = getOrCreateExternalRef();
        Map<String, Object> identity = new HashMap<>();
        identity.put("externalRef", externalRef);
        SharedApi.service().resolveAnonymous(identity).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                String citizenId = response.isSuccessful() && response.body() != null
                        ? String.valueOf(response.body().get("id")) : null;
                postCitizenReport(report, citizenId);
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable throwable) {
                Log.e("DataRepo", "Anonymous identity sync unavailable", throwable);
                postCitizenReport(report, null);
            }
        });

        // Also mirror to cloud so the existing Firebase pipeline keeps working.
        syncReportToCloud(report);
    }

    private void postCitizenReport(Report report, String citizenId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("citizenId", citizenId);
        payload.put("category", report.category);
        payload.put("description", report.description);
        payload.put("location", report.location);
        payload.put("municipality", report.municipality);
        payload.put("urgency", report.urgency == null ? "medium" : report.urgency.toLowerCase());
        payload.put("status", "submitted");
        SharedApi.service().createReport(payload).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                if (!response.isSuccessful()) {
                    Log.e("DataRepo", "Shared API report sync failed: " + response.code());
                }
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable throwable) {
                Log.e("DataRepo", "Shared API report sync unavailable", throwable);
            }
        });
    }

    /** Mirrors a report to Firestore + Realtime Database (shared cloud feed). */
    private void syncReportToCloud(Report report) {
        FirebaseManager fm = FirebaseManager.getInstance();
        if (fm.getFirestore() != null) {
            fm.getFirestore().collection("reports").add(report);
        }
        if (fm.getDatabase() != null) {
            fm.getDatabase().getReference("live_feed").push().setValue(report);
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
