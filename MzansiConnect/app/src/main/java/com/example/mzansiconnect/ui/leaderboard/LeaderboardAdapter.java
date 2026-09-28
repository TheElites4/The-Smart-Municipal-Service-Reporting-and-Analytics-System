package com.example.mzansiconnect.ui.leaderboard;

import android.graphics.drawable.GradientDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.example.mzansiconnect.R;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Renders leaderboard rows from the shared API (web Leaderboard.tsx). Each
 * entry: name, reports, points, rank.
 */
public class LeaderboardAdapter extends RecyclerView.Adapter<LeaderboardAdapter.ViewHolder> {

    public static final class Entry {

        public final int rank;
        public final String name;
        public final int reports;
        public final int points;

        public Entry(int rank, String name, int reports, int points) {
            this.rank = rank;
            this.name = name;
            this.reports = reports;
            this.points = points;
        }
    }

    private final List<Entry> entries = new ArrayList<>();

    public void submit(List<Entry> next) {
        entries.clear();
        if (next != null) {
            entries.addAll(next);
        }
        notifyDataSetChanged();
    }

    /**
     * Builds entries from the raw `/api/leaderboard` JSON rows.
     */
    public static List<Entry> fromApi(List<Map<String, Object>> rows) {
        List<Entry> result = new ArrayList<>();
        if (rows == null) {
            return result;
        }
        int rank = 1;
        for (Map<String, Object> row : rows) {
            String name = row.get("name") == null ? "Citizen" : String.valueOf(row.get("name"));
            int reports = asInt(row.get("reports"));
            int points = asInt(row.get("points"));
            result.add(new Entry(rank++, name, reports, points));
        }
        return result;
    }

    private static int asInt(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value == null) {
            return 0;
        }
        try {
            return (int) Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_leaderboard, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Entry entry = entries.get(position);
        holder.rank.setText(String.valueOf(entry.rank));
        holder.name.setText(entry.name);
        holder.reports.setText(entry.reports + " reports");
        holder.points.setText(String.valueOf(entry.points));

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(holder.itemView.getResources().getColor(rankColor(entry.rank)));
        holder.rank.setBackground(bg);
    }

    private int rankColor(int rank) {
        switch (rank) {
            case 1:
                return R.color.web_gold;
            case 2:
                return R.color.web_text_muted;
            case 3:
                return R.color.portal_button_orange;
            default:
                return R.color.web_primary;
        }
    }

    @Override
    public int getItemCount() {
        return entries.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {

        final TextView rank;
        final TextView name;
        final TextView reports;
        final TextView points;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            rank = itemView.findViewById(R.id.leader_rank);
            name = itemView.findViewById(R.id.leader_name);
            reports = itemView.findViewById(R.id.leader_reports);
            points = itemView.findViewById(R.id.leader_points);
        }
    }
}
