import TextBox from "@/components/TextBox";

export default function Conversation() {
  return <div className="grid grid-cols-6 gap-2">
    <div className="col-span-10  items-center justify-center gap-2 w-full h-full bg-gray-100 rounded-md p-2">
      <TextBox />   
    </div>
    <button className="col-span-2 bg-blue-500 text-white p-2 rounded-md w-full h-full">Send</button>
    </div>;
}

