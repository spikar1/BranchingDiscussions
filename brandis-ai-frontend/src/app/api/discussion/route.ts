import { NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { CreateDiscussionDto } from '@/types/chat';
import { Discussion } from '@/types/chat';

// Create an axios instance with default config
const api = axios.create({
  baseURL: 'http://localhost:5198/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

export async function POST(req: Request) {
  try {
    const { title } = await req.json() as CreateDiscussionDto;
    
    const { data } = await api.post('/Discussions', {
      title: title,
      userId: 'user123'
    });
    
    console.log('Created discussion:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating discussion:', error);
    const axiosError = error as AxiosError;
    return NextResponse.json(
      { error: 'Failed to create discussion' },
      { status: axiosError.response?.status || 500 }
    );
  }
} 

export async function GET(req: Request) {
  try {
    console.log("Fetching discussions from local API...");
    
    const { data } = await api.get('/Discussions');
    console.log("Successfully fetched discussions:", data);

    const response = data as Discussion[];
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching discussions:', error);
    const axiosError = error as AxiosError;
    return NextResponse.json(
      { error: 'Failed to fetch discussions from local API' },
      { status: axiosError.response?.status || 500 }
    );
  }
}