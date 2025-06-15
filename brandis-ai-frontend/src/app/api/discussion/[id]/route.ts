import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = {
    params: {
        id: string;
    };
};
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = params;
    const { data } = await axios.get(`http://localhost:5198/api/Discussions/${id}`);
    return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id } = params;
    const { data } = await axios.delete(`http://localhost:5198/api/Discussions/${id}`);
    return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    const { id } = params;
    const { data } = await axios.put(`http://localhost:5198/api/Discussions/${id}`);
    return NextResponse.json(data);
}