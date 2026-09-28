package com.example.mzansiconnect.ui.chatbot;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.example.mzansiconnect.R;
import java.util.ArrayList;
import java.util.List;

/**
 * Chat bubbles for the Citizen Assistant (web CitizenAssistant.tsx).
 */
public class ChatAdapter extends RecyclerView.Adapter<ChatAdapter.ViewHolder> {

    public static final class Message {

        final String text;
        final boolean fromUser;

        public Message(String text, boolean fromUser) {
            this.text = text;
            this.fromUser = fromUser;
        }
    }

    private static final int TYPE_USER = 1;
    private static final int TYPE_BOT = 0;

    private final List<Message> messages = new ArrayList<>();

    public void add(Message message) {
        messages.add(message);
        notifyItemInserted(messages.size() - 1);
    }

    @Override
    public int getItemViewType(int position) {
        return messages.get(position).fromUser ? TYPE_USER : TYPE_BOT;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        int layout = viewType == TYPE_USER ? R.layout.item_message_user : R.layout.item_message_bot;
        View view = LayoutInflater.from(parent.getContext()).inflate(layout, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        holder.text.setText(messages.get(position).text);
    }

    @Override
    public int getItemCount() {
        return messages.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {

        final TextView text;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            text = itemView.findViewById(R.id.message_text);
        }
    }
}
