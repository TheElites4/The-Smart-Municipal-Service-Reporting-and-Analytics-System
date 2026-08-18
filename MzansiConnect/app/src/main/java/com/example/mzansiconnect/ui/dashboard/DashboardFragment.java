package com.example.mzansiconnect.ui.dashboard;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.AppDatabase;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import java.util.concurrent.Executors;

public class DashboardFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_dashboard, container, false);

        FloatingActionButton fab = root.findViewById(R.id.fab_new_report);
        TextView totalTv = root.findViewById(R.id.stat_total);
        TextView resolvedTv = root.findViewById(R.id.stat_resolved);

        fab.setOnClickListener(v -> Navigation.findNavController(v).navigate(R.id.action_dashboard_to_submission));

        // Load SQL Stats
        Executors.newSingleThreadExecutor().execute(() -> {
            int total = AppDatabase.getInstance(getContext()).appDao().getTotalReports(1);
            int resolved = AppDatabase.getInstance(getContext()).appDao().getResolvedReports(1);
            
            if (getActivity() != null) {
                getActivity().runOnUiThread(() -> {
                    totalTv.setText(String.valueOf(total));
                    resolvedTv.setText(String.valueOf(resolved));
                });
            }
        });
        
        return root;
    }
}
