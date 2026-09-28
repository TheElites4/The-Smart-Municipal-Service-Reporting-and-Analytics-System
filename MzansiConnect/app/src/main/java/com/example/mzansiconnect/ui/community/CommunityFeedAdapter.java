package com.example.mzansiconnect.ui.community;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.Report;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Community Feed cards sorted by upvotes (web CommunityFeed.tsx).
 * "Me Too" awards hero points once per report per session.
 */
public class CommunityFeedAdapter extends RecyclerView.Adapter<CommunityFeedAdapter.ViewHolder> {

    public interface Listener {
        void onMeToo(Report report);
        void onViewReport(Report report);
    }

    private final List<Report> reports = new ArrayList<>();
    private final Set<Integer> voted = new HashSet<>();
    private final Listener listener;
    private final SimpleDateFormat dateFormat = new SimpleDateFormat("d MMM", Locale.ENGLISH);

    public CommunityFeedAdapter(Listener listener) {
        this.listener = listener;
    }

    public void submit(List<Report> next) {
        reports.clear();
        if (next != null) {
            reports.addAll(next);
        }
        notifyDataSetChanged();
    }

    public int votedCount() {
        return voted.size();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_community_report, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Report report = reports.get(position);
        holder.reference.setText(report.publicReference != null
                ? report.publicReference : ("RPT-" + report.id));
        holder.category.setText(report.category);
        holder.description.setText(report.description);
        holder.meta.setText("\uD83D\uDCCD " + report.location + "   \uD83D\uDD52 "
                + dateFormat.format(new Date(report.timestamp)));

        if (report.upvotes > 0) {
            holder.people.setVisibility(View.VISIBLE);
            holder.people.setText(report.upvotes + " people also reported this");
        } else {
            holder.people.setVisibility(View.GONE);
        }

        boolean isVoted = voted.contains(report.id);
        holder.meToo.setEnabled(!isVoted);
        holder.meToo.setText(isVoted ? "UPVOTED" : "\uD83D\uDC4D Me Too");

        holder.meToo.setOnClickListener(v -> {
            if (voted.contains(report.id)) return;
            voted.add(report.id);
            report.upvotes += 1;
            notifyItemChanged(holder.getAdapterPosition());
            if (listener != null) listener.onMeToo(report);
        });
        holder.viewDetails.setOnClickListener(v -> {
            if (listener != null) listener.onViewReport(report);
        });
    }

    @Override
    public int getItemCount() {
        return reports.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {

        final TextView reference;
        final TextView category;
        final TextView description;
        final TextView meta;
        final TextView people;
        final TextView viewDetails;
        final Button meToo;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            reference = itemView.findViewById(R.id.feed_reference);
            category = itemView.findViewById(R.id.feed_category);
            description = itemView.findViewById(R.id.feed_description);
            meta = itemView.findViewById(R.id.feed_meta);
            people = itemView.findViewById(R.id.feed_people);
            viewDetails = itemView.findViewById(R.id.feed_view_details);
            meToo = itemView.findViewById(R.id.feed_me_too);
        }
    }
}
