package com.example.mzansiconnect.ui.dashboard;

import android.graphics.drawable.GradientDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.Report;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Renders the citizen's report list, matching web Dashboard.tsx cards
 * (status pill colour, date, category, description, urgency dot).
 */
public class ReportsAdapter extends RecyclerView.Adapter<ReportsAdapter.ViewHolder> {

    public interface OnReportClick {
        void onClick(Report report);
    }

    private final List<Report> reports = new ArrayList<>();
    private final OnReportClick listener;
    private final SimpleDateFormat dateFormat =
            new SimpleDateFormat("d MMM yyyy", Locale.ENGLISH);

    public ReportsAdapter(OnReportClick listener) {
        this.listener = listener;
    }

    public void submit(List<Report> next) {
        reports.clear();
        if (next != null) reports.addAll(next);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_report, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Report report = reports.get(position);

        String reference = report.publicReference != null
                ? report.publicReference : ("RPT-" + report.id);
        holder.reference.setText(reference);
        holder.date.setText(dateFormat.format(new Date(report.timestamp)));
        holder.category.setText(report.category);
        holder.description.setText(report.description);

        String normalized = normalizeStatus(report.status);
        holder.status.setText(statusLabel(normalized));
        holder.status.setTextColor(statusTextColor(holder.itemView, normalized));
        holder.status.setBackground(statusBackground(holder.itemView, normalized));

        holder.urgency.setText(capitalize(
                report.urgency == null ? "medium" : report.urgency) + " urgency");
        holder.urgencyDot.setBackgroundResource(0);
        GradientDrawable dot = new GradientDrawable();
        dot.setShape(GradientDrawable.OVAL);
        dot.setColor(urgencyColor(holder.itemView, report.urgency));
        holder.urgencyDot.setBackground(dot);

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) listener.onClick(report);
        });
    }

    @Override
    public int getItemCount() {
        return reports.size();
    }

    public static String normalizeStatus(String status) {
        if (status == null) return "submitted";
        String lower = status.toLowerCase(Locale.ENGLISH).replace('_', '-');
        if (lower.contains("progress")) return "in-progress";
        if (lower.contains("resolved")) return "resolved";
        if (lower.contains("review")) return "in-progress";
        return "submitted";
    }

    private String statusLabel(String status) {
        switch (status) {
            case "in-progress": return "IN PROGRESS";
            case "resolved": return "RESOLVED";
            default: return "SUBMITTED";
        }
    }

    private int statusTextColor(View v, String status) {
        switch (status) {
            case "in-progress": return v.getResources().getColor(R.color.status_progress);
            case "resolved": return v.getResources().getColor(R.color.status_resolved);
            default: return v.getResources().getColor(R.color.status_submitted);
        }
    }

    private android.graphics.drawable.Drawable statusBackground(View v, String status) {
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setCornerRadius(v.getResources().getDisplayMetrics().density * 12);
        int color;
        switch (status) {
            case "in-progress": color = R.color.status_progress_bg; break;
            case "resolved": color = R.color.status_resolved_bg; break;
            default: color = R.color.status_submitted_bg; break;
        }
        bg.setColor(v.getResources().getColor(color));
        return bg;
    }

    private int urgencyColor(View v, String urgency) {
        if (urgency == null) return v.getResources().getColor(R.color.urgency_medium);
        switch (urgency.toLowerCase(Locale.ENGLISH)) {
            case "high": return v.getResources().getColor(R.color.urgency_high);
            case "low": return v.getResources().getColor(R.color.urgency_low);
            default: return v.getResources().getColor(R.color.urgency_medium);
        }
    }

    private String capitalize(String value) {
        if (value == null || value.isEmpty()) return "";
        return value.substring(0, 1).toUpperCase(Locale.ENGLISH) + value.substring(1);
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        final TextView reference;
        final TextView date;
        final TextView status;
        final TextView category;
        final TextView description;
        final TextView urgency;
        final View urgencyDot;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            reference = itemView.findViewById(R.id.report_reference);
            date = itemView.findViewById(R.id.report_date);
            status = itemView.findViewById(R.id.report_status);
            category = itemView.findViewById(R.id.report_category);
            description = itemView.findViewById(R.id.report_description);
            urgency = itemView.findViewById(R.id.report_urgency);
            urgencyDot = itemView.findViewById(R.id.report_urgency_dot);
        }
    }
}
