package com.example.mzansiconnect.ui.services;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import com.example.mzansiconnect.R;

public class ServiceDetailFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_service_detail, container, false);

        TextView title = root.findViewById(R.id.detail_title);
        TextView desc = root.findViewById(R.id.detail_description);

        if (getArguments() != null) {
            title.setText(getArguments().getString("serviceName"));
            desc.setText(getArguments().getString("serviceDesc"));
        }

        return root;
    }
}