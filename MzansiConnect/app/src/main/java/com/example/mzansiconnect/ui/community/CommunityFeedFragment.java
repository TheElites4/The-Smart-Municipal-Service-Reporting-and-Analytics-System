package com.example.mzansiconnect.ui.community;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;
import androidx.recyclerview.widget.RecyclerView;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.AppDatabase;
import com.example.mzansiconnect.data.Report;
import com.example.mzansiconnect.util.Gamification;
import java.util.List;
import java.util.concurrent.Executors;

/**
 * Mirrors web Citizen Portal CommunityFeed.tsx:
 * trending reports (sorted by upvotes), "Me Too" awarding hero points, hero footer.
 */
public class CommunityFeedFragment extends Fragment {

    private CommunityFeedAdapter adapter;
    private TextView emptyView;
    private TextView heroFooter;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_community_feed, container, false);

        RecyclerView recycler = root.findViewById(R.id.recycler_feed);
        emptyView = root.findViewById(R.id.feed_empty);
        heroFooter = root.findViewById(R.id.feed_hero_points);

        adapter = new CommunityFeedAdapter(new CommunityFeedAdapter.Listener() {
            @Override
            public void onMeToo(Report report) {
                Executors.newSingleThreadExecutor().execute(() -> {
                    if (getContext() == null) return;
                    AppDatabase.getInstance(requireContext()).appDao().upvoteReport(report.id);
                });
                Gamification.awardUpvotePoints(requireContext());
                refreshHeroFooter();
            }

            @Override
            public void onViewReport(Report report) {
                Bundle args = new Bundle();
                args.putInt("reportId", report.id);
                Navigation.findNavController(root).navigate(R.id.navigation_report_detail, args);
            }
        });
        recycler.setAdapter(adapter);

        root.findViewById(R.id.btn_feed_back).setOnClickListener(v ->
                Navigation.findNavController(v).navigateUp());

        loadTrending();
        return root;
    }

    private void loadTrending() {
        Executors.newSingleThreadExecutor().execute(() -> {
            if (getContext() == null) return;
            List<Report> trending = AppDatabase.getInstance(requireContext())
                    .appDao().getTrendingReports();
            if (isAdded() && getActivity() != null) {
                getActivity().runOnUiThread(() -> {
                    if (!isAdded()) return;
                    adapter.submit(trending);
                    emptyView.setVisibility(trending.isEmpty() ? View.VISIBLE : View.GONE);
                    refreshHeroFooter();
                });
            }
        });
    }

    private void refreshHeroFooter() {
        if (heroFooter == null) return;
        Gamification.HeroProfile profile = Gamification.getHeroProfile(requireContext());
        heroFooter.setText(getString(R.string.wc_feed_hero_points,
                getString(R.string.wc_hero_points), profile.points));
    }
}
