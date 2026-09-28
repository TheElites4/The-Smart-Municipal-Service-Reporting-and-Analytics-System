package com.example.mzansiconnect.ui.dashboard;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;
import androidx.recyclerview.widget.RecyclerView;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.AppDatabase;
import com.example.mzansiconnect.data.Report;
import com.example.mzansiconnect.data.SharedApi;
import com.example.mzansiconnect.ui.status.ServiceStatusRenderer;
import com.example.mzansiconnect.util.Gamification;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Mirrors web Citizen Portal Dashboard.tsx:
 * nav bar (user), load-shedding banner, hero badge, 3 stat cards,
 * "My Reports" list, embedded Service Status Board + Leaderboard.
 */
public class DashboardFragment extends Fragment {

    private ReportsAdapter adapter;
    private TextView statTotal, statPending, statResolved;
    private TextView heroPoints, heroLevel, heroNext, heroStats;
    private TextView reportsEmpty, loadSheddingDetail;
    private RecyclerView recycler;
    private LinearLayout leaderboardContainer;
    private TextView leaderboardEmpty;
    private final int currentUserId = 1;

    private final ActivityResultLauncher<String[]> locationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                Boolean fine = result.get(android.Manifest.permission.ACCESS_FINE_LOCATION);
                Boolean coarse = result.get(android.Manifest.permission.ACCESS_COARSE_LOCATION);
                if (Boolean.TRUE.equals(fine) || Boolean.TRUE.equals(coarse)) {
                    loadLoadSheddingStatus();
                }
            });

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_dashboard, container, false);

        statTotal = root.findViewById(R.id.stat_total);
        statPending = root.findViewById(R.id.stat_pending);
        statResolved = root.findViewById(R.id.stat_resolved);
        heroPoints = root.findViewById(R.id.hero_points);
        heroLevel = root.findViewById(R.id.hero_level);
        heroNext = root.findViewById(R.id.hero_next);
        heroStats = root.findViewById(R.id.hero_stats);
        reportsEmpty = root.findViewById(R.id.reports_empty);
        recycler = root.findViewById(R.id.recycler_reports);
        leaderboardContainer = root.findViewById(R.id.leaderboard_container);
        leaderboardEmpty = root.findViewById(R.id.leaderboard_empty);
        loadSheddingDetail = root.findViewById(R.id.banner_load_shedding_detail);

        if (recycler != null) {
            adapter = new ReportsAdapter(this::openReport);
            recycler.setAdapter(adapter);
            recycler.setNestedScrollingEnabled(false);
        }

        View fab = root.findViewById(R.id.fab_new_report);
        if (fab != null) {
            fab.setOnClickListener(v ->
                    Navigation.findNavController(v).navigate(R.id.action_dashboard_to_submission));
        }

        View fabAssistant = root.findViewById(R.id.fab_assistant);
        if (fabAssistant != null) {
            fabAssistant.setOnClickListener(v ->
                    Navigation.findNavController(v).navigate(R.id.navigation_chatbot));
        }

        View community = root.findViewById(R.id.btn_community_feed);
        if (community != null) {
            community.setOnClickListener(v ->
                    Navigation.findNavController(v).navigate(R.id.navigation_community_feed));
        }

        ImageButton logout = root.findViewById(R.id.btn_dashboard_logout);
        if (logout != null) {
            logout.setOnClickListener(v ->
                    Navigation.findNavController(v).navigate(R.id.navigation_home));
        }

        // Embedded service status board (web Advanced Sections)
        ServiceStatusRenderer.bind(root.findViewById(R.id.service_status_container));

        refreshHeroBadge();
        loadReports();
        loadLeaderboard();
        loadLoadSheddingStatus();
        listenForRealtimeReports();

        return root;
    }

    @Override
    public void onResume() {
        super.onResume();
        refreshHeroBadge();
        loadReports();
        loadLoadSheddingStatus();
    }

    private void loadLoadSheddingStatus() {
        if (loadSheddingDetail == null) return;

        if (getContext() != null && (androidx.core.content.ContextCompat.checkSelfPermission(requireContext(),
                android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED ||
                androidx.core.content.ContextCompat.checkSelfPermission(requireContext(),
                        android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED)) {

            com.google.android.gms.location.FusedLocationProviderClient fusedClient =
                    com.google.android.gms.location.LocationServices.getFusedLocationProviderClient(requireActivity());
            fusedClient.getLastLocation().addOnSuccessListener(location -> {
                if (location != null) {
                    fetchStatusForLocation(location.getLatitude(), location.getLongitude());
                } else {
                    fetchStatusForLocation(-26.2041, 28.0473);
                }
            }).addOnFailureListener(e -> fetchStatusForLocation(-26.2041, 28.0473));
        } else {
            locationPermissionLauncher.launch(new String[]{
                    android.Manifest.permission.ACCESS_FINE_LOCATION,
                    android.Manifest.permission.ACCESS_COARSE_LOCATION
            });
        }
    }

    private void fetchStatusForLocation(double lat, double lng) {
        if (getContext() == null) return;
        String suburb = null;
        String municipality = null;
        try {
            android.location.Geocoder geocoder = new android.location.Geocoder(requireContext(), java.util.Locale.getDefault());
            List<android.location.Address> addresses = geocoder.getFromLocation(lat, lng, 1);
            if (addresses != null && !addresses.isEmpty()) {
                android.location.Address addr = addresses.get(0);
                suburb = addr.getSubLocality() != null ? addr.getSubLocality() : (addr.getLocality() != null ? addr.getLocality() : addr.getAdminArea());
                municipality = addr.getLocality() != null ? addr.getLocality() : addr.getAdminArea();
            }
        } catch (Exception e) {
            // Geocoder fallback
        }

        final String areaName = (suburb != null ? suburb : (municipality != null ? municipality : "Current Location"));

        SharedApi.service().getLocationStatus(String.valueOf(lat), String.valueOf(lng), municipality).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                if (!isAdded() || loadSheddingDetail == null) return;
                if (response.isSuccessful() && response.body() != null) {
                    Map<String, Object> body = response.body();
                    Boolean isCurrent = Boolean.TRUE.equals(body.get("current"));
                    int stage = asInt(body.get("stage"));

                    if (isCurrent && stage > 0) {
                        loadSheddingDetail.setText("Stage " + stage + " Active · " + areaName);
                    } else {
                        loadSheddingDetail.setText("No active load shedding · " + areaName);
                    }
                } else {
                    loadSheddingDetail.setText("No active load shedding · " + areaName);
                }
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable throwable) {
                if (!isAdded() || loadSheddingDetail == null) return;
                loadSheddingDetail.setText("No active load shedding · " + areaName);
            }
        });
    }

    private void openReport(Report report) {
        Bundle args = new Bundle();
        args.putInt("reportId", report.id);
        if (getView() != null) {
            Navigation.findNavController(getView())
                    .navigate(R.id.action_dashboard_to_detail, args);
        }
    }

    private void refreshHeroBadge() {
        if (getContext() == null || heroPoints == null) return;
        Gamification.HeroProfile profile = Gamification.getHeroProfile(requireContext());
        Gamification.HeroLevel level = Gamification.getHeroLevel(profile.points);

        heroPoints.setText(String.valueOf(profile.points));
        heroLevel.setText(getString(resolveLevelLabel(level.labelKey)));
        if (level.isMaxLevel()) {
            heroNext.setText("");
        } else {
            heroNext.setText(getString(R.string.wc_points_to_next_placeholder, level.next));
        }
        heroStats.setText(getString(R.string.wc_hero_stats_placeholder,
                profile.reportsSubmitted, profile.upvotesGiven));
    }

    private int resolveLevelLabel(String labelKey) {
        switch (labelKey) {
            case "levelSilver": return R.string.wc_hero_level_silver;
            case "levelGold": return R.string.wc_hero_level_gold;
            case "levelPlatinum": return R.string.wc_hero_level_platinum;
            case "levelDiamond": return R.string.wc_hero_level_diamond;
            default: return R.string.wc_hero_level_bronze;
        }
    }

    private com.google.firebase.firestore.ListenerRegistration firestoreListener;

    private void listenForRealtimeReports() {
        try {
            com.example.mzansiconnect.data.FirebaseManager fm = com.example.mzansiconnect.data.FirebaseManager.getInstance();
            if (fm.getFirestore() != null) {
                firestoreListener = fm.getFirestore().collection("reports")
                        .addSnapshotListener((snapshots, e) -> {
                            if (isAdded() && snapshots != null) {
                                loadReports();
                            }
                        });
            }
        } catch (Exception e) {
            // Non-fatal if Firebase isn't configured
        }
    }

    private void loadReports() {
        Executors.newSingleThreadExecutor().execute(() -> {
            if (getContext() == null) return;
            List<Report> reports = AppDatabase.getInstance(requireContext())
                    .appDao().getAllReports();
            int total = reports.size();
            int inProgress = 0;
            int resolved = 0;
            for (Report report : reports) {
                String status = ReportsAdapter.normalizeStatus(report.status);
                if ("in-progress".equals(status)) inProgress++;
                else if ("resolved".equals(status)) resolved++;
            }
            final int fTotal = total, fProgress = inProgress, fResolved = resolved;
            final List<Report> snapshot = new ArrayList<>(reports);
            if (isAdded() && getActivity() != null) {
                getActivity().runOnUiThread(() -> {
                    if (!isAdded() || statTotal == null) return;
                    statTotal.setText(String.valueOf(fTotal));
                    statPending.setText(String.valueOf(fProgress));
                    statResolved.setText(String.valueOf(fResolved));
                    if (adapter != null) adapter.submit(snapshot);
                    if (reportsEmpty != null) {
                        reportsEmpty.setVisibility(snapshot.isEmpty() ? View.VISIBLE : View.GONE);
                    }
                    if (recycler != null) {
                        recycler.setVisibility(snapshot.isEmpty() ? View.GONE : View.VISIBLE);
                    }
                });
            }
        });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (firestoreListener != null) {
            firestoreListener.remove();
        }
    }

    private void loadLeaderboard() {
        SharedApi.service().getLeaderboard().enqueue(new Callback<List<Map<String, Object>>>() {
            @Override
            public void onResponse(Call<List<Map<String, Object>>> call,
                                   Response<List<Map<String, Object>>> response) {
                if (!isAdded() || leaderboardContainer == null) return;
                List<Map<String, Object>> body = response.body();
                leaderboardContainer.removeAllViews();
                if (body == null || body.isEmpty()) {
                    if (leaderboardEmpty != null) leaderboardEmpty.setVisibility(View.VISIBLE);
                } else {
                    if (leaderboardEmpty != null) leaderboardEmpty.setVisibility(View.GONE);
                    LayoutInflater inflater = LayoutInflater.from(requireContext());
                    int rank = 1;
                    for (Map<String, Object> entry : body) {
                        View item = inflater.inflate(R.layout.item_leaderboard,
                                leaderboardContainer, false);
                        ((TextView) item.findViewById(R.id.leader_rank)).setText(String.valueOf(rank));
                        ((TextView) item.findViewById(R.id.leader_name))
                                .setText(entry.get("name") == null ? "Citizen" : String.valueOf(entry.get("name")));
                        ((TextView) item.findViewById(R.id.leader_reports))
                                .setText(getString(R.string.wc_reports_count_placeholder, asInt(entry.get("reports"))));
                        ((TextView) item.findViewById(R.id.leader_points))
                                .setText(String.valueOf(asInt(entry.get("points"))));
                        leaderboardContainer.addView(item);
                        rank++;
                    }
                }
                updateCurrentUserFooter();
            }

            @Override
            public void onFailure(Call<List<Map<String, Object>>> call, Throwable throwable) {
                if (!isAdded() || leaderboardEmpty == null) return;
                leaderboardEmpty.setVisibility(View.VISIBLE);
                updateCurrentUserFooter();
            }
        });
    }

    private void updateCurrentUserFooter() {
        if (!isAdded() || getView() == null) return;
        Gamification.HeroProfile profile = Gamification.getHeroProfile(requireContext());
        TextView youPoints = getView().findViewById(R.id.leader_you_points);
        TextView youStats = getView().findViewById(R.id.leader_you_stats);
        if (youPoints != null) youPoints.setText(String.valueOf(profile.points));
        if (youStats != null) {
            youStats.setText(getString(R.string.wc_hero_stats_placeholder,
                    profile.reportsSubmitted, profile.upvotesGiven));
        }
    }

    private static int asInt(Object value) {
        if (value instanceof Number) return ((Number) value).intValue();
        if (value == null) return 0;
        try {
            return (int) Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
