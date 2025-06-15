'use client';

import { useState } from 'react';
import { Message, Discussion, CreateDiscussionDto } from '@/types/chat';
import ChatMessage from '@/components/ChatMessage';
import TextBox from '@/components/TextBox';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleNewMessage = async (content: string) => {
    setIsLoading(true);

    try {
      // Create a new discussion
      const createDiscussionDto: CreateDiscussionDto = {
        title: content,
        userId: 'user123' // This should come from your auth system
      };

      const response = await fetch('/api/discussion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createDiscussionDto),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newDiscussion: Discussion = await response.json();
      console.log('Created new discussion:', newDiscussion);
      
      // Update discussions state
      setDiscussions(prev => [...prev, newDiscussion]);
      
      // Add the first message to the messages state
      if (newDiscussion.messages.length > 0) {
        setMessages(prev => [...prev, newDiscussion.messages[0]]);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: 'Sorry, I encountered an error creating the discussion. Please try again.',
        createdAt: new Date(),
        isFromAI: true,
        discussionId: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDiscussions = async () => {
    try {
      const response = await fetch('/api/discussion', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const fetchedDiscussions: Discussion[] = await response.json();
      console.log('Fetched discussions:', fetchedDiscussions);
      setDiscussions(fetchedDiscussions);
    } catch (error) {
      console.error('Error fetching discussions:', error);
    }
  };

  const handleDeleteDiscussion = async (id: string) => {
    try {
      const response = await fetch(`/api/discussion/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update discussions state
      setDiscussions(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting discussion:', error);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <button 
        className="bg-blue-500 text-white p-2 rounded-md m-4" 
        onClick={fetchDiscussions}
      >
        Refresh Discussions
      </button>
      <div className="flex flex-row p-4">
        {discussions.map((discussion) => (
          <div key={discussion.id} className="bg-gray-200 p-4 rounded-md m-2 flex flex-row">
            <h2>{discussion.title}</h2>
            <button className="bg-red-500 text-white p-2 rounded-md m-2 btn-danger" onClick={() => handleDeleteDiscussion(discussion.id)}>X</button> 
          </div>
        ))}
      </div>
      <div className="flex-1 p-4 space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-gray-300 rounded-lg p-4">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        {!isLoading && (
          <div className="flex justify-end">
            <TextBox onSendMessage={handleNewMessage} isLoading={isLoading} />
          </div>
        )}
      </div>
    </div>
  );
}
