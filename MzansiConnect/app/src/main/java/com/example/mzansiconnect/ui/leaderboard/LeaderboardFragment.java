package com.example.mzansiconnect.ui.leaderboard;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.SharedApi;
import com.example.mzansiconnect.util.Gamification;
import java.util.List;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/** Mirrors web Leaderboard.tsx as a dedicated screen. */
public class LeaderboardFragment extends Fragment {

    private LeaderboardAdapter adapter;
    private TextView emptyView;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_leaderboard, container, false);

        RecyclerView recycler = root.findViewById(R.id.leaderboard_recycler);
        emptyView = root.findViewById(R.id.leaderboard_full_empty);
        recycler.setLayoutManager(new LinearLayoutManager(getContext()));
        recycler.setNestedScrollingEnabled(false);
        adapter = new LeaderboardAdapter();
        recycler.setAdapter(adapter);

        loadLeaderboard(root);
        return root;
    }

    private void loadLeaderboard(View root) {
        SharedApi.service().getLeaderboard().enqueue(new Callback<List<Map<String, Object>>>() {
            @Override
            public void onResponse(Call<List<Map<String, Object>>> call,
                                   Response<List<Map<String, Object>>> response) {
                if (!isAdded()) return;
                List<LeaderboardAdapter.Entry> entries = LeaderboardAdapter.fromApi(response.body());
                adapter.submit(entries);
                emptyView.setVisibility(entries.isEmpty() ? View.VISIBLE : View.GONE);
                updateFooter(root);
            }

            @Override
            public void onFailure(Call<List<Map<String, Object>>> call, Throwable throwable) {
                if (!isAdded()) return;
                emptyView.setVisibility(View.VISIBLE);
                updateFooter(root);
            }
        });
    }

    private void updateFooter(View root) {
        Gamification.HeroProfile profile = Gamification.getHeroProfile(requireContext());
        TextView points = root.findViewById(R.id.leaderboard_full_you_points);
        TextView stats = root.findViewById(R.id.leaderboard_full_you_stats);
        if (points != null) points.setText(String.valueOf(profile.points));
        if (stats != null) {
            stats.setText(getString(R.string.wc_hero_stats_placeholder,
                    profile.reportsSubmitted, profile.upvotesGiven));
        }
    }
}
