package com.example.mzansiconnect.ui.chatbot;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.ImageButton;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.example.mzansiconnect.R;
import com.example.mzansiconnect.util.AssistantBot;

/**
 * Mirrors web CitizenAssistant.tsx: keyword chatbot with a 1s "typing" delay.
 */
public class ChatbotFragment extends Fragment {

    private ChatAdapter adapter;
    private RecyclerView recycler;
    private EditText input;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_chatbot, container, false);

        recycler = root.findViewById(R.id.chat_recycler);
        input = root.findViewById(R.id.edit_chat);
        ImageButton send = root.findViewById(R.id.btn_send);

        recycler.setLayoutManager(new LinearLayoutManager(getContext()));
        adapter = new ChatAdapter();
        recycler.setAdapter(adapter);

        adapter.add(new ChatAdapter.Message(getString(R.string.wc_assistant_welcome), false));

        send.setOnClickListener(v -> handleSend());
        input.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                handleSend();
                return true;
            }
            return false;
        });

        View chipReport = root.findViewById(R.id.chip_report);
        View chipEmergency = root.findViewById(R.id.chip_emergency);
        View chipLoadshedding = root.findViewById(R.id.chip_loadshedding);
        View chipWater = root.findViewById(R.id.chip_water);
        View chipHero = root.findViewById(R.id.chip_hero);

        if (chipReport != null) chipReport.setOnClickListener(v -> sendQuickQuery("How to report a pothole or leak?"));
        if (chipEmergency != null) chipEmergency.setOnClickListener(v -> sendQuickQuery("Emergency SOS police fire numbers"));
        if (chipLoadshedding != null) chipLoadshedding.setOnClickListener(v -> sendQuickQuery("Load shedding stage power status"));
        if (chipWater != null) chipWater.setOnClickListener(v -> sendQuickQuery("Water leak burst pipe report"));
        if (chipHero != null) chipHero.setOnClickListener(v -> sendQuickQuery("How do Hero Points work?"));

        return root;
    }

    private void sendQuickQuery(String query) {
        if (input != null) {
            input.setText(query);
            handleSend();
        }
    }

    private void handleSend() {
        String text = input.getText() == null ? "" : input.getText().toString().trim();
        if (text.isEmpty()) return;

        adapter.add(new ChatAdapter.Message(text, true));
        input.setText("");
        scrollToBottom();

        handler.postDelayed(() -> {
            if (!isAdded()) return;
            adapter.add(new ChatAdapter.Message(AssistantBot.respond(text), false));
            scrollToBottom();
        }, 1000);
    }

    private void scrollToBottom() {
        if (adapter.getItemCount() > 0) {
            recycler.scrollToPosition(adapter.getItemCount() - 1);
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        handler.removeCallbacksAndMessages(null);
    }
}
