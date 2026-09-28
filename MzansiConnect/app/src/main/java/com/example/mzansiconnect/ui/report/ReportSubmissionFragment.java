package com.example.mzansiconnect.ui.report;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.drawable.GradientDrawable;
import android.location.Address;
import android.location.Geocoder;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.data.DataRepository;
import com.example.mzansiconnect.data.Report;
import com.example.mzansiconnect.util.Gamification;
import com.example.mzansiconnect.util.Municipalities;
import com.example.mzansiconnect.util.ServiceData;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Mirrors web Citizen Portal ReportForm.tsx:
 * coloured category grid, AI keyword category suggestion, GPS + reverse geocode,
 * municipality autocomplete, urgency selector, photo picker (max 4), validation.
 */
public class ReportSubmissionFragment extends Fragment {

    private static final int MAX_PHOTOS = 4;

    private FusedLocationProviderClient fusedLocationClient;
    private EditText locationEdit, descEdit;
    private AutoCompleteTextView municipalityEdit;
    private TextView municipalityDetected, aiStatus, descriptionError, locationError,
            categoryError, descriptionCount;
    private CheckBox safetyCheck;

    private Button urgencyLow, urgencyMedium, urgencyHigh;
    private String selectedCategory = null;
    private String selectedUrgency = "medium";
    private final List<View> categoryTiles = new ArrayList<>();
    private final List<Object> photoUris = new ArrayList<>();

    private final ActivityResultLauncher<String> photoPicker =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri == null) return;
                if (photoUris.size() >= MAX_PHOTOS) {
                    Toast.makeText(requireContext(), R.string.wc_photo_limit, Toast.LENGTH_SHORT).show();
                    return;
                }
                photoUris.add(uri);
                renderPhotoPreviews();
            });

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_report_submission, container, false);

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity());
        locationEdit = root.findViewById(R.id.edit_location);
        descEdit = root.findViewById(R.id.edit_desc);
        municipalityEdit = root.findViewById(R.id.edit_municipality);
        municipalityDetected = root.findViewById(R.id.tv_municipality_detected);
        aiStatus = root.findViewById(R.id.ai_status);
        descriptionError = root.findViewById(R.id.description_error);
        locationError = root.findViewById(R.id.location_error);
        categoryError = root.findViewById(R.id.category_error);
        descriptionCount = root.findViewById(R.id.description_count);
        safetyCheck = root.findViewById(R.id.check_safety);
        urgencyLow = root.findViewById(R.id.btn_urgency_low);
        urgencyMedium = root.findViewById(R.id.btn_urgency_medium);
        urgencyHigh = root.findViewById(R.id.btn_urgency_high);
        ImageButton gpsBtn = root.findViewById(R.id.btn_gps);
        Button submitBtn = root.findViewById(R.id.btn_submit_report);
        Button cancelBtn = root.findViewById(R.id.btn_cancel_report);
        View aiSuggest = root.findViewById(R.id.btn_ai_suggest);
        View photoZone = root.findViewById(R.id.photo_dropzone);

        buildCategoryGrid(root.findViewById(R.id.category_grid));
        buildMunicipalityAutocomplete();

        descEdit.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void afterTextChanged(android.text.Editable s) {
                descriptionCount.setText(getString(R.string.wc_character_count_placeholder, s.length()));
                if (aiStatus.getVisibility() == View.VISIBLE) aiStatus.setVisibility(View.GONE);
            }
        });

        aiSuggest.setOnClickListener(v -> runAiSuggestion());
        gpsBtn.setOnClickListener(v -> getGPSLocation());
        photoZone.setOnClickListener(v -> photoPicker.launch("image/*"));

        urgencyLow.setOnClickListener(v -> setUrgency("low"));
        urgencyMedium.setOnClickListener(v -> setUrgency("medium"));
        urgencyHigh.setOnClickListener(v -> setUrgency("high"));
        setUrgency("medium");

        cancelBtn.setOnClickListener(v -> Navigation.findNavController(root).navigateUp());
        submitBtn.setOnClickListener(v -> submitReport(root));

        return root;
    }

    /* ---------- Category grid ---------- */

    private void buildCategoryGrid(GridLayout grid) {
        if (grid == null) return;
        LayoutInflater inflater = LayoutInflater.from(requireContext());
        int margin = (int) (4 * getResources().getDisplayMetrics().density);

        for (String category : ServiceData.CATEGORIES) {
            View tile = inflater.inflate(R.layout.item_category_tile, grid, false);
            GridLayout.LayoutParams params = new GridLayout.LayoutParams();
            params.width = 0;
            params.height = GridLayout.LayoutParams.WRAP_CONTENT;
            params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
            params.setMargins(margin, margin, margin, margin);
            tile.setLayoutParams(params);

            TextView label = tile.findViewById(R.id.category_label);
            label.setText(category);
            tile.setTag(category);
            tile.setOnClickListener(v -> selectCategory(category));
            categoryTiles.add(tile);
            grid.addView(tile);
        }
    }

    private void selectCategory(String category) {
        selectedCategory = category;
        if (categoryError != null) categoryError.setVisibility(View.GONE);
        for (View tile : categoryTiles) {
            boolean selected = category.equals(tile.getTag());
            TextView label = tile.findViewById(R.id.category_label);
            GradientDrawable bg = new GradientDrawable();
            bg.setShape(GradientDrawable.RECTANGLE);
            bg.setCornerRadius(10 * getResources().getDisplayMetrics().density);
            if (selected) {
                bg.setColor(getResources().getColor(R.color.web_primary));
                label.setTextColor(getResources().getColor(R.color.white));
            } else {
                bg.setColor(getResources().getColor(R.color.web_card));
                bg.setStroke((int) getResources().getDisplayMetrics().density,
                        getResources().getColor(R.color.web_border));
                label.setTextColor(getResources().getColor(R.color.web_text));
            }
            tile.setBackground(bg);
        }
    }

    /* ---------- AI category suggestion (keyword scan, web handleAiDetection) ---------- */

    private void runAiSuggestion() {
        String description = descEdit.getText() == null ? "" : descEdit.getText().toString();
        String detected = ServiceData.detectCategory(description);
        aiStatus.setVisibility(View.VISIBLE);
        if (detected != null) {
            aiStatus.setText(getString(R.string.wc_ai_detected) + ": " + detected
                    + " - Category auto-selected");
            aiStatus.setBackgroundColor(getResources().getColor(R.color.status_resolved_bg));
            aiStatus.setTextColor(getResources().getColor(R.color.status_resolved));
            selectCategory(detected);
        } else {
            aiStatus.setText(R.string.wc_ai_failed);
            aiStatus.setBackgroundColor(getResources().getColor(R.color.status_submitted_bg));
            aiStatus.setTextColor(getResources().getColor(R.color.urgency_high));
        }
    }

    /* ---------- Urgency ---------- */

    private void setUrgency(String level) {
        selectedUrgency = level;
        styleUrgencyButton(urgencyLow, "low".equals(level));
        styleUrgencyButton(urgencyMedium, "medium".equals(level));
        styleUrgencyButton(urgencyHigh, "high".equals(level));
    }

    private void styleUrgencyButton(Button button, boolean active) {
        if (button == null) return;
        button.setBackgroundResource(active ? R.drawable.web_hero_button : R.drawable.web_outline_button);
        button.setTextColor(getResources().getColor(active ? R.color.black : R.color.web_primary));
    }

    /* ---------- Municipality autocomplete ---------- */

    private void buildMunicipalityAutocomplete() {
        if (municipalityEdit == null) return;
        ArrayAdapter<String> adapter = new ArrayAdapter<>(requireContext(),
                android.R.layout.simple_dropdown_item_1line, Municipalities.names());
        municipalityEdit.setAdapter(adapter);
    }

    /* ---------- Photos ---------- */

    private void renderPhotoPreviews() {
        LinearLayout container = getView() == null ? null
                : getView().findViewById(R.id.photo_preview_container);
        if (container == null) return;
        container.removeAllViews();
        int size = (int) (72 * getResources().getDisplayMetrics().density);
        int margin = (int) (4 * getResources().getDisplayMetrics().density);
        for (Object uri : photoUris) {
            android.widget.ImageView image = new android.widget.ImageView(requireContext());
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(size, size);
            params.setMargins(margin, margin, margin, margin);
            image.setLayoutParams(params);
            image.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);
            image.setImageURI((android.net.Uri) uri);
            container.addView(image);
        }
    }

    /* ---------- GPS + reverse geocode (web getMunicipality) ---------- */

    private void getGPSLocation() {
        if (!isAdded()) return;
        if (ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 100);
            return;
        }

        fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
            if (!isAdded() || getContext() == null) return;
            if (location != null) {
                String coordinates = String.format(Locale.ENGLISH, "%.6f, %.6f",
                        location.getLatitude(), location.getLongitude());
                locationEdit.setText(coordinates);
                reverseGeocode(location.getLatitude(), location.getLongitude());
            } else {
                Toast.makeText(requireContext(), "GPS location unavailable. Try again outdoors.",
                        Toast.LENGTH_LONG).show();
            }
        });
    }

    private void reverseGeocode(double latitude, double longitude) {
        try {
            List<Address> addresses = new Geocoder(requireContext(), Locale.getDefault())
                    .getFromLocation(latitude, longitude, 1);
            if (addresses != null && !addresses.isEmpty()) {
                Address address = addresses.get(0);
                String municipality = address.getLocality() != null
                        ? address.getLocality() : address.getSubAdminArea();
                if (municipality != null) {
                    municipalityDetected.setVisibility(View.VISIBLE);
                    municipalityDetected.setText(getString(R.string.wc_municipality_nearest, municipality));
                    municipalityEdit.setText(municipality);
                }
            }
        } catch (Exception error) {
            // Leave the manual municipality field for the citizen to complete.
        }
    }

    /* ---------- Validation + submit ---------- */

    private void submitReport(View root) {
        String description = descEdit.getText() == null ? "" : descEdit.getText().toString().trim();
        String location = locationEdit.getText() == null ? "" : locationEdit.getText().toString().trim();
        String municipality = municipalityEdit.getText() == null ? "" : municipalityEdit.getText().toString().trim();

        boolean valid = true;
        if (selectedCategory == null) {
            categoryError.setVisibility(View.VISIBLE);
            valid = false;
        }
        if (description.length() < 20) {
            descriptionError.setVisibility(View.VISIBLE);
            descriptionError.setText(description.isEmpty()
                    ? getString(R.string.wc_description_required)
                    : getString(R.string.wc_description_min));
            valid = false;
        }
        if (location.isEmpty()) {
            locationError.setVisibility(View.VISIBLE);
            valid = false;
        }
        if (!valid) return;

        long now = System.currentTimeMillis();
        Report report = new Report();
        report.category = selectedCategory;
        report.description = description;
        report.location = location;
        report.municipality = municipality;
        report.urgency = selectedUrgency;
        report.status = "submitted";
        report.timestamp = now;
        report.userId = 1;
        report.isSafetyAlert = safetyCheck != null && safetyCheck.isChecked();
        report.publicReference = "RPT-" + now;
        report.points = Gamification.POINTS_PER_REPORT;

        Gamification.HeroProfile previous = Gamification.getHeroProfile(requireContext());
        Gamification.HeroProfile updated = Gamification.awardReportPoints(requireContext());
        boolean leveledUp = !Gamification.getHeroLevel(previous.points).level
                .equals(Gamification.getHeroLevel(updated.points).level);

        DataRepository.getInstance(requireContext()).submitReportWebParity(report);

        Toast.makeText(requireContext(),
                "Report submitted! +" + Gamification.POINTS_PER_REPORT + " Hero Points 🎉",
                Toast.LENGTH_LONG).show();
        if (leveledUp) {
            Toast.makeText(requireContext(), "Level up! 🏆", Toast.LENGTH_LONG).show();
        }
        Navigation.findNavController(root).navigateUp();
    }
}
