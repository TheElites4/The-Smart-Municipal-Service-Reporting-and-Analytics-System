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
import com.example.mzansiconnect.data.DataRepository;
import com.example.mzansiconnect.data.Report;
import com.example.mzansiconnect.data.SharedApi;
import com.example.mzansiconnect.util.Gamification;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Mirrors web Citizen Portal Dashboard.tsx:
 * Loads the citizen's database reports, summary values, live status, and leaderboard.
 */
public class DashboardFragment extends Fragment {

    private ReportsAdapter adapter;
    private TextView statTotal, statPending, statResolved;
    private TextView heroPoints, heroLevel, heroNext, heroStats;
    private TextView reportsEmpty, loadSheddingDetail;
    private RecyclerView recycler;
    private LinearLayout leaderboardContainer;
    private TextView leaderboardEmpty;

    private final ActivityResultLauncher<String[]> locationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                Boolean fine = result.get(android.Manifest.permission.ACCESS_FINE_LOCATION);
                Boolean coarse = result.get(android.Manifest.permission.ACCESS_COARSE_LOCATION);
                if (Boolean.TRUE.equals(fine) || Boolean.TRUE.equals(coarse)) {
                    loadLoadSheddingStatus();
                } else if (loadSheddingDetail != null) {
                    loadSheddingDetail.setText("Location permission is required for live status.");
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
                    Navigation.findNavController(v).navigate(R.id.action_dashboard_to_community));
        }

        ImageButton logout = root.findViewById(R.id.btn_dashboard_logout);
        if (logout != null) {
            logout.setOnClickListener(v ->
                    Navigation.findNavController(v).navigate(R.id.navigation_home));
        }

        refreshHeroBadge();
        loadReports();
        loadLeaderboard();
        loadLoadSheddingStatus();
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
                    loadSheddingDetail.setText("Device location is unavailable.");
                }
            }).addOnFailureListener(e -> loadSheddingDetail.setText("Device location is unavailable."));
        } else {
            locationPermissionLauncher.launch(new String[]{
                    android.Manifest.permission.ACCESS_FINE_LOCATION,
                    android.Manifest.permission.ACCESS_COARSE_LOCATION
            });
        }
    }

    private void fetchStatusForLocation(double lat, double lng) {
        if (getContext() == null) return;
        // Geocoder.getFromLocation is a blocking network call on many devices, so it
        // must run off the main thread or it throws NetworkOnMainThreadException and
        // the whole load-shedding lookup silently falls back to "unavailable".
        final android.content.Context appContext = requireContext().getApplicationContext();
        new Thread(() -> {
            String suburb = null;
            String municipality = null;
            try {
                android.location.Geocoder geocoder = new android.location.Geocoder(appContext, java.util.Locale.getDefault());
                List<android.location.Address> addresses = geocoder.getFromLocation(lat, lng, 1);
                if (addresses != null && !addresses.isEmpty()) {
                    android.location.Address addr = addresses.get(0);
                    suburb = addr.getSubLocality() != null ? addr.getSubLocality() : (addr.getLocality() != null ? addr.getLocality() : addr.getAdminArea());
                    municipality = addr.getLocality() != null ? addr.getLocality() : addr.getAdminArea();
                }
            } catch (Exception e) {
                // Geocoder fallback - the API can still resolve the area from coordinates.
            }
            final String resolvedMunicipality = municipality;
            final String areaName = (suburb != null ? suburb : (municipality != null ? municipality : "Current Location"));
            if (getActivity() == null) return;
            getActivity().runOnUiThread(() -> requestStatus(lat, lng, resolvedMunicipality, areaName));
        }).start();
    }

    private void requestStatus(double lat, double lng, String municipality, String areaName) {
        if (!isAdded() || loadSheddingDetail == null) return;
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
                    } else if (isCurrent) {
                        loadSheddingDetail.setText("Load shedding is active · " + areaName);
                    } else {
                        loadSheddingDetail.setText("No active load shedding · " + areaName);
                    }
                } else {
                    String message = "Live load-shedding status unavailable.";
                    try {
                        if (response.errorBody() != null) {
                            String providerError = new org.json.JSONObject(response.errorBody().string())
                                    .optString("error", "");
                            if (!providerError.isEmpty()) message = providerError;
                        }
                    } catch (org.json.JSONException | java.io.IOException error) {
                        android.util.Log.w("DashboardFragment", "Unable to parse load-shedding API error response", error);
                    }
                    loadSheddingDetail.setText(message);
                }
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable throwable) {
                if (!isAdded() || loadSheddingDetail == null) return;
                loadSheddingDetail.setText("Live load-shedding status unavailable.");
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

    private void loadReports() {
        DataRepository.getInstance(requireContext()).refreshCitizenReports(new DataRepository.ReportsRefreshCallback() {
            @Override
            public void onSuccess(List<Report> reports) {
                if (!isAdded() || statTotal == null) return;
                int inProgress = 0;
                int resolved = 0;
                for (Report report : reports) {
                    String status = ReportsAdapter.normalizeStatus(report.status);
                    if ("in-progress".equals(status)) inProgress++;
                    else if ("resolved".equals(status) || "closed".equals(status)) resolved++;
                }
                statTotal.setText(String.valueOf(reports.size()));
                statPending.setText(String.valueOf(inProgress));
                statResolved.setText(String.valueOf(resolved));
                if (adapter != null) adapter.submit(reports);
                if (reportsEmpty != null) reportsEmpty.setVisibility(reports.isEmpty() ? View.VISIBLE : View.GONE);
                if (recycler != null) recycler.setVisibility(reports.isEmpty() ? View.GONE : View.VISIBLE);
            }

            @Override
            public void onFailure(String message) {
                if (!isAdded() || reportsEmpty == null) return;
                reportsEmpty.setText(message);
                reportsEmpty.setVisibility(View.VISIBLE);
                if (recycler != null) recycler.setVisibility(View.GONE);
            }
        });
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
