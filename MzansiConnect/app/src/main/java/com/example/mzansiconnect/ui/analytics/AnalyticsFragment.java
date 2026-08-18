package com.example.mzansiconnect.ui.analytics;

import android.graphics.Color;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import com.example.mzansiconnect.R;
import com.github.mikephil.charting.charts.PieChart;
import com.github.mikephil.charting.data.PieData;
import com.github.mikephil.charting.data.PieDataSet;
import com.github.mikephil.charting.data.PieEntry;
import java.util.ArrayList;
import java.util.List;

public class AnalyticsFragment extends Fragment {
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_analytics, container, false);
        
        PieChart pieChart = root.findViewById(R.id.pie_chart);
        setupPieChart(pieChart);
        
        return root;
    }

    private void setupPieChart(PieChart chart) {
        List<PieEntry> entries = new ArrayList<>();
        entries.add(new PieEntry(40, "Water"));
        entries.add(new PieEntry(30, "Power"));
        entries.add(new PieEntry(20, "Roads"));
        entries.add(new PieEntry(10, "Other"));

        PieDataSet set = new PieDataSet(entries, "");
        set.setColors(new int[]{Color.BLUE, Color.YELLOW, Color.RED, Color.GRAY});
        set.setValueTextColor(Color.WHITE);
        set.setValueTextSize(12f);

        PieData data = new PieData(set);
        chart.setData(data);
        chart.getDescription().setEnabled(false);
        chart.setHoleColor(Color.TRANSPARENT);
        chart.setEntryLabelColor(Color.WHITE);
        chart.animateY(1000);
        chart.invalidate();
    }
}
