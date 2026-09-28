package com.example.mzansiconnect.ui.status;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import android.widget.LinearLayout;
import com.example.mzansiconnect.R;

/** Mirrors web ServiceStatusBoard.tsx as a dedicated screen. */
public class ServiceStatusFragment extends Fragment {
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_service_status, container, false);
        ServiceStatusRenderer.bind(root.findViewById(R.id.service_status_container));
        return root;
    }
}
