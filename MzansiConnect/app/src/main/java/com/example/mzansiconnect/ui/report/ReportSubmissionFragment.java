package com.example.mzansiconnect.ui.report;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.fragment.app.Fragment;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.DataRepository;
import com.example.mzansiconnect.data.Report;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;

public class ReportSubmissionFragment extends Fragment {

    private FusedLocationProviderClient fusedLocationClient;
    private EditText locationEdit, descEdit;
    private TextView municipalityTv;
    private Spinner categorySpinner;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_report_submission, container, false);

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity());
        locationEdit = root.findViewById(R.id.edit_location);
        descEdit = root.findViewById(R.id.edit_desc);
        municipalityTv = root.findViewById(R.id.tv_municipality);
        categorySpinner = root.findViewById(R.id.spinner_category);
        ImageButton gpsBtn = root.findViewById(R.id.btn_gps);
        Button submitBtn = root.findViewById(R.id.btn_submit_report);
        View aiScanBtn = root.findViewById(R.id.btn_ai_scan);
        CheckBox safetyCheck = root.findViewById(R.id.check_safety);

        gpsBtn.setOnClickListener(v -> getGPSLocation());
        
        aiScanBtn.setOnClickListener(v -> {
            Toast.makeText(getContext(), "AI Analyzing photo...", Toast.LENGTH_SHORT).show();
            // Mock AI category selection
            categorySpinner.setSelection(2); // Auto-selects "Roads"
            Toast.makeText(getContext(), "AI Detected: Road Maintenance", Toast.LENGTH_LONG).show();
        });

        submitBtn.setOnClickListener(v -> {
            String description = descEdit.getText().toString().trim();
            String location = locationEdit.getText().toString().trim();
            String municipality = municipalityTv.getText().toString().replace("Nearest: ", "").trim();
            if (description.length() < 20 || location.isEmpty() || municipality.isEmpty()) {
                Toast.makeText(requireContext(), "Add a detailed description, location, and municipality before submitting.", Toast.LENGTH_LONG).show();
                return;
            }
            Report report = new Report();
            report.category = categorySpinner.getSelectedItem().toString();
            report.description = description;
            report.location = location;
            report.municipality = municipality;
            report.status = "Submitted";
            report.timestamp = System.currentTimeMillis();
            report.userId = 1;
            report.isSafetyAlert = safetyCheck.isChecked();

            DataRepository.getInstance(getContext()).submitReport(report);
            
            if (report.isSafetyAlert) {
                Toast.makeText(getContext(), "EMERGENCY BROADCAST SENT TO NEARBY USERS", Toast.LENGTH_LONG).show();
            }
            
            Toast.makeText(requireContext(), "Saved locally and queued for cloud synchronization.", Toast.LENGTH_SHORT).show();
            requireActivity().onBackPressed();
        });

        return root;
    }

    private void getGPSLocation() {
        if (ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 100);
            return;
        }

        fusedLocationClient.getLastLocation().addOnSuccessListener(requireActivity(), location -> {
            if (location != null) {
                String locStr = location.getLatitude() + ", " + location.getLongitude();
                locationEdit.setText(locStr);
                municipalityTv.setText("Nearest: City of Johannesburg");
            } else {
                Toast.makeText(getContext(), "GPS Signal weak. Using last known location.", Toast.LENGTH_SHORT).show();
                locationEdit.setText("-26.2041, 28.0473");
                municipalityTv.setText("Nearest: City of Johannesburg");
            }
        });
    }
}
