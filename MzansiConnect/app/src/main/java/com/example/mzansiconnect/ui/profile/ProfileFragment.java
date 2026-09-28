package com.example.mzansiconnect.ui.profile;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.os.LocaleListCompat;
import androidx.fragment.app.Fragment;
import com.example.mzansiconnect.R;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

public class ProfileFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_profile, container, false);

        View langSetting = root.findViewById(R.id.setting_language);
        if (langSetting != null) {
            langSetting.setOnClickListener(v -> {
                String[] languages = {"🇬🇧 English", "🇿🇦 isiZulu", "🇿🇦 isiXhosa", "🇿🇦 Afrikaans"};
                String[] codes = {"en", "zu", "xh", "af"};

                new MaterialAlertDialogBuilder(requireContext())
                        .setTitle("Select Language / Khetha Ulimi")
                        .setItems(languages, (dialog, which) -> {
                            String selectedCode = codes[which];
                            AppCompatDelegate.setApplicationLocales(
                                    LocaleListCompat.forLanguageTags(selectedCode)
                            );
                        })
                        .show();
            });
        }

        return root;
    }
}
