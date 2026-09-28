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
import com.example.mzansiconnect.util.ServiceData;
import com.github.mikephil.charting.charts.BarChart;
import com.github.mikephil.charting.charts.LineChart;
import com.github.mikephil.charting.charts.PieChart;
import com.github.mikephil.charting.components.XAxis;
import com.github.mikephil.charting.data.BarData;
import com.github.mikephil.charting.data.BarDataSet;
import com.github.mikephil.charting.data.BarEntry;
import com.github.mikephil.charting.data.Entry;
import com.github.mikephil.charting.data.LineData;
import com.github.mikephil.charting.data.LineDataSet;
import com.github.mikephil.charting.data.PieData;
import com.github.mikephil.charting.data.PieDataSet;
import com.github.mikephil.charting.data.PieEntry;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Mirrors web AnalyticsDashboard.tsx: Reports by Category (bar),
 * Status Distribution (pie), Monthly Trend reports vs resolved (line).
 */
public class AnalyticsFragment extends Fragment {

    private static final int[] CATEGORY_COLORS =
            {0xFF1E5A7D, 0xFF4A8F8F, 0xFFFFB612, 0xFFE03C31, 0xFF7C3AED, 0xFF059669, 0xFF6B7280};
    private static final int[] STATUS_COLORS = {0xFFFFB612, 0xFF1E5A7D, 0xFF059669};

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_analytics, container, false);
        setupCategoryChart(root.findViewById(R.id.bar_chart));
        setupStatusPie(root.findViewById(R.id.pie_chart));
        setupTrendChart(root.findViewById(R.id.line_chart));
        return root;
    }

    private void setupCategoryChart(BarChart chart) {
        List<BarEntry> entries = new ArrayList<>();
        List<Integer> colors = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        int index = 0;
        for (Map.Entry<String, Integer> category : ServiceData.CATEGORY_STATS.entrySet()) {
            entries.add(new BarEntry(index, category.getValue()));
            colors.add(CATEGORY_COLORS[index % CATEGORY_COLORS.length]);
            labels.add(category.getKey());
            index++;
        }

        BarDataSet set = new BarDataSet(entries, "");
        set.setColors(colors);
        set.setValueTextColor(Color.DKGRAY);
        set.setValueTextSize(11f);

        chart.setData(new BarData(set));
        chart.getDescription().setEnabled(false);
        chart.getXAxis().setValueFormatter(new com.github.mikephil.charting.formatter.ValueFormatter() {
            @Override
            public String getFormattedValue(float value) {
                int i = (int) value;
                return i >= 0 && i < labels.size() ? labels.get(i) : "";
            }
        });
        chart.getXAxis().setGranularity(1f);
        chart.getXAxis().setPosition(XAxis.XAxisPosition.BOTTOM);
        chart.getXAxis().setLabelRotationAngle(-30f);
        chart.getAxisRight().setEnabled(false);
        chart.animateY(800);
        chart.invalidate();
    }

    private void setupStatusPie(PieChart chart) {
        List<PieEntry> entries = new ArrayList<>();
        entries.add(new PieEntry(ServiceData.STATUS_DISTRIBUTION[0],
                getString(R.string.status_submitted)));
        entries.add(new PieEntry(ServiceData.STATUS_DISTRIBUTION[1],
                getString(R.string.status_in_progress)));
        entries.add(new PieEntry(ServiceData.STATUS_DISTRIBUTION[2],
                getString(R.string.status_resolved)));

        PieDataSet set = new PieDataSet(entries, "");
        set.setColors(STATUS_COLORS);
        set.setValueTextColor(Color.WHITE);
        set.setValueTextSize(12f);

        chart.setData(new PieData(set));
        chart.getDescription().setEnabled(false);
        chart.setUsePercentValues(false);
        chart.setDrawEntryLabels(true);
        chart.setEntryLabelColor(Color.DKGRAY);
        chart.animateY(800);
        chart.invalidate();
    }

    private void setupTrendChart(LineChart chart) {
        List<Entry> reports = new ArrayList<>();
        List<Entry> resolved = new ArrayList<>();
        for (int i = 0; i < ServiceData.TREND_MONTHS.length; i++) {
            reports.add(new Entry(i, ServiceData.TREND_REPORTS[i]));
            resolved.add(new Entry(i, ServiceData.TREND_RESOLVED[i]));
        }

        LineDataSet reportsSet = new LineDataSet(reports, getString(R.string.wc_total_reports));
        reportsSet.setColor(CATEGORY_COLORS[0]);
        reportsSet.setCircleColor(CATEGORY_COLORS[0]);
        reportsSet.setLineWidth(2f);
        LineDataSet resolvedSet = new LineDataSet(resolved, getString(R.string.wc_resolved));
        resolvedSet.setColor(STATUS_COLORS[2]);
        resolvedSet.setCircleColor(STATUS_COLORS[2]);
        resolvedSet.setLineWidth(2f);

        chart.setData(new LineData(reportsSet, resolvedSet));
        chart.getDescription().setEnabled(false);
        chart.getXAxis().setValueFormatter(new com.github.mikephil.charting.formatter.ValueFormatter() {
            @Override
            public String getFormattedValue(float value) {
                int i = (int) value;
                return i >= 0 && i < ServiceData.TREND_MONTHS.length
                        ? ServiceData.TREND_MONTHS[i] : "";
            }
        });
        chart.getXAxis().setGranularity(1f);
        chart.getXAxis().setPosition(XAxis.XAxisPosition.BOTTOM);
        chart.getAxisRight().setEnabled(false);
        chart.animateY(800);
        chart.invalidate();
    }
}
