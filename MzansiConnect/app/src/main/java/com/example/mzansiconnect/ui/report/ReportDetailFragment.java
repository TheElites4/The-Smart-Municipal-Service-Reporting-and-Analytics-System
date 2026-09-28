package com.example.mzansiconnect.ui.report;

import android.content.Intent;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.AppDatabase;
import com.example.mzansiconnect.data.Report;
import com.example.mzansiconnect.data.SharedApi;
import com.example.mzansiconnect.ui.dashboard.ReportsAdapter;
import com.example.mzansiconnect.util.Gamification;
import com.example.mzansiconnect.util.ServiceData;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Executors;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Mirrors web Citizen Portal ReportDetail.tsx:
 * status pill, info card, SLA countdown, photo gallery, tracking timeline, WhatsApp share.
 */
public class ReportDetailFragment extends Fragment {

    private TextView referenceTv, statusTv, categoryTv, descriptionTv, locationTv,
            submittedTv, urgencyTv, slaTitle, slaDetail, aiBanner;
    private LinearLayout slaCard, photosCard, photosContainer, timelineContainer;
    private TextView photosTitle, timelineEmpty;
    private Report report;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable slaTicker;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_report_detail, container, false);

        referenceTv = root.findViewById(R.id.detail_reference);
        statusTv = root.findViewById(R.id.detail_status);
        categoryTv = root.findViewById(R.id.detail_category);
        descriptionTv = root.findViewById(R.id.detail_description);
        locationTv = root.findViewById(R.id.detail_location);
        submittedTv = root.findViewById(R.id.detail_submitted);
        urgencyTv = root.findViewById(R.id.detail_urgency);
        slaCard = root.findViewById(R.id.card_sla);
        slaTitle = root.findViewById(R.id.sla_title);
        slaDetail = root.findViewById(R.id.sla_detail);
        photosCard = root.findViewById(R.id.card_photos);
        photosContainer = root.findViewById(R.id.photos_container);
        photosTitle = root.findViewById(R.id.photos_title);
        timelineContainer = root.findViewById(R.id.timeline_container);
        timelineEmpty = root.findViewById(R.id.timeline_empty);
        aiBanner = root.findViewById(R.id.detail_ai_banner);

        root.findViewById(R.id.btn_back_dashboard).setOnClickListener(v ->
                Navigation.findNavController(v).navigateUp());
        root.findViewById(R.id.btn_detail_back).setOnClickListener(v ->
                Navigation.findNavController(v).navigateUp());

        int reportId = getArguments() == null ? -1 : getArguments().getInt("reportId", -1);
        if (reportId == -1) {
            // Fallback: legacy nav args
            categoryTv.setText(getArguments() == null ? "Service"
                    : getArguments().getString("serviceName", "Service"));
            descriptionTv.setText(getArguments() == null ? ""
                    : getArguments().getString("serviceDesc", ""));
            return root;
        }

        loadReport(reportId, root);
        return root;
    }

    private void loadReport(int reportId, View root) {
        Executors.newSingleThreadExecutor().execute(() -> {
            if (getContext() == null) return;
            // Load the report straight from Room by primary key.
            List<Report> all = AppDatabase.getInstance(requireContext()).appDao().getAllReports();
            Report found = null;
            for (Report candidate : all) {
                if (candidate.id == reportId) {
                    found = candidate;
                    break;
                }
            }
            final Report resolved = found;
            if (isAdded() && getActivity() != null) {
                getActivity().runOnUiThread(() -> bindReport(resolved, root));
            }
        });
    }

    private void bindReport(Report resolved, View root) {
        if (resolved == null) return;
        report = resolved;
        SimpleDateFormat full = new SimpleDateFormat("EE, d MMMM yyyy", Locale.ENGLISH);

        referenceTv.setText(resolved.publicReference != null
                ? resolved.publicReference : ("RPT-" + resolved.id));
        categoryTv.setText(resolved.category);
        descriptionTv.setText(resolved.description);
        locationTv.setText(resolved.municipality == null || resolved.municipality.isEmpty()
                ? resolved.location : resolved.location + "\n" + resolved.municipality);
        submittedTv.setText(full.format(new Date(resolved.timestamp)));

        String urgency = resolved.urgency == null ? "medium" : resolved.urgency.toLowerCase(Locale.ENGLISH);
        urgencyTv.setText(capitalize(urgency));
        urgencyTv.setTextColor(urgencyTextColor(urgency));
        urgencyTv.setBackground(urgencyBackground(urgency));

        String status = ReportsAdapter.normalizeStatus(resolved.status);
        statusTv.setText(statusLabel(status));
        statusTv.setTextColor(statusTextColor(status));
        statusTv.setBackground(statusBackground(status));

        if (resolved.aiDetectedCategory != null && !resolved.aiDetectedCategory.isEmpty()) {
            aiBanner.setVisibility(View.VISIBLE);
            aiBanner.setText(getString(R.string.wc_ai_detected) + ": " + resolved.aiDetectedCategory);
        }

        setupSla(resolved);
        renderTimeline(resolved);
        wireActions(resolved, root);
    }

    /* ---------- SLA countdown (web useEffect interval) ---------- */

    private void setupSla(Report resolved) {
        String status = ReportsAdapter.normalizeStatus(resolved.status);
        if ("resolved".equals(status)) {
            slaCard.setVisibility(View.GONE);
            return;
        }
        slaCard.setVisibility(View.VISIBLE);
        int slaHours = ServiceData.slaHours(resolved.category);
        long deadline = resolved.timestamp + (long) slaHours * 60 * 60 * 1000;

        slaTicker = new Runnable() {
            @Override
            public void run() {
                long diff = deadline - System.currentTimeMillis();
                if (diff <= 0) {
                    slaTitle.setText(R.string.wc_sla_overdue);
                    slaTitle.setTextColor(getResources().getColor(R.color.urgency_high));
                    slaDetail.setText(getString(R.string.wc_sla_expected, slaHours, "0h 0m"));
                    return;
                }
                long hours = diff / (1000 * 60 * 60);
                long minutes = (diff % (1000 * 60 * 60)) / (1000 * 60);
                String remaining = hours + "h " + minutes + "m";
                slaDetail.setText(getString(R.string.wc_sla_expected, slaHours, remaining));
                handler.postDelayed(this, 30000);
            }
        };
        handler.post(slaTicker);
    }

    /* ---------- Timeline (web /api/reports/:id/events) ---------- */

    private void renderTimeline(Report resolved) {
        String identifier = resolved.remoteId != null ? resolved.remoteId
                : (resolved.publicReference != null ? resolved.publicReference : String.valueOf(resolved.id));
        SharedApi.service().getReportEvents(identifier).enqueue(new Callback<List<Map<String, Object>>>() {
            @Override
            public void onResponse(Call<List<Map<String, Object>>> call,
                                   Response<List<Map<String, Object>>> response) {
                if (!isAdded() || timelineContainer == null) return;
                List<Map<String, Object>> events = response.body();
                timelineContainer.removeAllViews();
                if (events == null || events.isEmpty()) {
                    timelineEmpty.setVisibility(View.VISIBLE);
                    return;
                }
                timelineEmpty.setVisibility(View.GONE);
                LayoutInflater inflater = LayoutInflater.from(requireContext());
                for (Map<String, Object> event : events) {
                    String note = event.get("note") == null
                            ? String.valueOf(event.get("to_status"))
                            : String.valueOf(event.get("note"));
                    View row = inflater.inflate(R.layout.item_timeline_event, timelineContainer, false);
                    ((TextView) row.findViewById(R.id.timeline_note)).setText(note);
                    ((TextView) row.findViewById(R.id.timeline_time))
                            .setText(String.valueOf(event.get("created_at")));
                    timelineContainer.addView(row);
                }
            }

            @Override
            public void onFailure(Call<List<Map<String, Object>>> call, Throwable throwable) {
                if (!isAdded() || timelineEmpty == null) return;
                timelineEmpty.setVisibility(View.VISIBLE);
            }
        });
    }

    /* ---------- Actions ---------- */

    private void wireActions(Report resolved, View root) {
        Button meToo = root.findViewById(R.id.btn_me_too);
        Button share = root.findViewById(R.id.btn_share_whatsapp);

        meToo.setOnClickListener(v -> {
            Executors.newSingleThreadExecutor().execute(() -> {
                if (getContext() == null) return;
                AppDatabase.getInstance(requireContext()).appDao().upvoteReport(resolved.id);
            });
            Gamification.awardUpvotePoints(requireContext());
            Toast.makeText(getContext(), "Me Too! +" + Gamification.POINTS_PER_UPVOTE
                    + " Hero Points ⭐", Toast.LENGTH_SHORT).show();
            meToo.setEnabled(false);
            meToo.setText("UPVOTED");
        });

        share.setOnClickListener(v -> {
            String reference = resolved.publicReference != null
                    ? resolved.publicReference : ("RPT-" + resolved.id);
            String message = getString(R.string.app_name) + " - " + reference + "\n"
                    + resolved.category + "\n" + resolved.description + "\n\uD83D\uDCCD "
                    + resolved.location;
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("https://wa.me/?text=" + Uri.encode(message)));
            startActivity(intent);
        });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (slaTicker != null) handler.removeCallbacks(slaTicker);
    }

    /* ---------- Styling helpers ---------- */

    private String statusLabel(String status) {
        switch (status) {
            case "in-progress": return getString(R.string.status_in_progress);
            case "resolved": return getString(R.string.status_resolved);
            default: return getString(R.string.status_submitted);
        }
    }

    private int statusTextColor(String status) {
        switch (status) {
            case "in-progress": return getResources().getColor(R.color.status_progress);
            case "resolved": return getResources().getColor(R.color.status_resolved);
            default: return getResources().getColor(R.color.status_submitted);
        }
    }

    private GradientDrawable statusBackground(String status) {
        GradientDrawable bg = chip();
        switch (status) {
            case "in-progress": bg.setColor(getResources().getColor(R.color.status_progress_bg)); break;
            case "resolved": bg.setColor(getResources().getColor(R.color.status_resolved_bg)); break;
            default: bg.setColor(getResources().getColor(R.color.status_submitted_bg)); break;
        }
        return bg;
    }

    private int urgencyTextColor(String urgency) {
        switch (urgency) {
            case "high": return getResources().getColor(R.color.urgency_high);
            case "low": return getResources().getColor(R.color.urgency_low);
            default: return getResources().getColor(R.color.urgency_medium);
        }
    }

    private GradientDrawable urgencyBackground(String urgency) {
        GradientDrawable bg = chip();
        switch (urgency) {
            case "high": bg.setColor(getResources().getColor(R.color.status_submitted_bg)); break;
            case "low": bg.setColor(getResources().getColor(R.color.status_resolved_bg)); break;
            default: bg.setColor(getResources().getColor(R.color.status_submitted_bg)); break;
        }
        return bg;
    }

    private GradientDrawable chip() {
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setCornerRadius(getResources().getDisplayMetrics().density * 12);
        return bg;
    }

    private String capitalize(String value) {
        if (value == null || value.isEmpty()) return "";
        return value.substring(0, 1).toUpperCase(Locale.ENGLISH) + value.substring(1);
    }
}
