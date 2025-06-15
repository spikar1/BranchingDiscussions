// Domain Models (mirror backend models)
export type Message = {
  id: string;
  content: string;
  createdAt: Date;
  isFromAI: boolean;
  discussionId: string;
}; 

export type Discussion = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  userId: string;
};

// API DTOs (Data Transfer Objects)
export type CreateDiscussionDto = {
  title: string;
  userId: string;
};

export type CreateMessageDto = {
  content: string;
  discussionId: string;
  isFromAI: boolean;
};

// UI-specific types
export type MessageDisplay = {
  id: string;
  content: string;
  createdAt: Date;
  isFromAI: boolean;
  discussionId: string;
  // UI-specific properties
  isHighlighted?: boolean;
  isEditing?: boolean;
};

export type DiscussionDisplay = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: MessageDisplay[];
  userId: string;
  // UI-specific properties
  isSelected?: boolean;
  unreadCount?: number;
};