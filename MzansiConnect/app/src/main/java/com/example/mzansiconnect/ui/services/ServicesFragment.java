package com.example.mzansiconnect.ui.services;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.example.mzansiconnect.R;
import java.util.ArrayList;
import java.util.List;

public class ServicesFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_services, container, false);

        RecyclerView recyclerView = root.findViewById(R.id.recycler_services);
        recyclerView.setLayoutManager(new LinearLayoutManager(getContext()));

        List<Service> serviceList = new ArrayList<>();
        serviceList.add(new Service("Home Affairs", "Apply for ID, Passport, or Certificates"));
        serviceList.add(new Service("Traffic Services", "Renew License, Pay Fines"));
        serviceList.add(new Service("Social Grants", "SASSA Grant applications and status"));
        serviceList.add(new Service("Health Services", "Book appointments, Access records"));
        serviceList.add(new Service("Education", "Matric certificates, Bursaries"));
        serviceList.add(new Service("Employment", "Job opportunities and resources"));

        ServicesAdapter adapter = new ServicesAdapter(serviceList);
        recyclerView.setAdapter(adapter);

        return root;
    }
}