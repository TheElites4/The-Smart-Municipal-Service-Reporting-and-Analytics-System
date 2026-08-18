package com.example.mzansiconnect.ui.report;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.AppDatabase;
import java.util.concurrent.Executors;

public class ReportDetailFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_report_detail, container, false);

        TextView title = root.findViewById(R.id.detail_category);
        TextView desc = root.findViewById(R.id.detail_description);
        Button meTooBtn = root.findViewById(R.id.btn_me_too);
        Button shareBtn = root.findViewById(R.id.btn_share_whatsapp);

        String category = "Unknown Service";
        String description = "";

        if (getArguments() != null) {
            category = getArguments().getString("serviceName", "Service");
            description = getArguments().getString("serviceDesc", "");
            title.setText(category);
            if (desc != null) desc.setText(description);
        }

        final String finalCategory = category;
        final String finalDesc = description;

        meTooBtn.setOnClickListener(v -> {
            Toast.makeText(getContext(), "Community Weight Increased!", Toast.LENGTH_SHORT).show();
            meTooBtn.setEnabled(false);
            meTooBtn.setText("UPVOTED");
        });

        shareBtn.setOnClickListener(v -> {
            String message = "MzansiReport Alert!\n\nIssue: " + finalCategory + "\nDetails: " + finalDesc + "\n\nSent via MzansiReport App";
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("https://api.whatsapp.com/send?text=" + Uri.encode(message)));
            startActivity(intent);
        });

        return root;
    }
}
