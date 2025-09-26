
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Paperclip, Loader2, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Mock messages for UI purposes
const mockMessages = [
    { id: 1, user: { name: "Trader Joe", avatar: "https://github.com/shadcn.png" }, text: "Anyone watching $AAPL today? Looks like it's ready to pop!", time: "10:30 AM" },
    { id: 2, user: { name: "You", avatar: "" }, text: "I am! Thinking of buying some calls.", time: "10:31 AM" },
    { id: 3, user: { name: "CryptoKate", avatar: "https://github.com/vercel.png" }, text: "I'd be careful, RSI is looking a bit overbought.", time: "10:32 AM" },
];


export function CommunityClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(mockMessages);
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);
    
    // In a real app, you would send the message to your backend here.
    // For this UI demo, we just add it to the local state.
    setTimeout(() => {
        const newMessage = {
            id: messages.length + 1,
            user: { name: "You", avatar: "" },
            text: message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages([...messages, newMessage]);
        setMessage("");
        setIsSending(false);
    }, 500);
  };
  
  const handleFileUpload = () => {
    toast({
        title: "Feature not available",
        description: "Image uploads are not implemented in this demo.",
    });
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold">Community Chat</h1>
      </header>
      
      <Card className="flex flex-col h-[75vh]">
        <CardHeader>
          <CardTitle>#general</CardTitle>
        </CardHeader>
        <CardContent ref={scrollAreaRef} className="flex-1 overflow-y-auto space-y-6 pr-2">
          {messages.map((msg, index) => (
            <div key={msg.id} className={cn("flex items-start gap-3", msg.user.name === "You" ? "flex-row-reverse" : "")}>
                <Avatar>
                    <AvatarImage src={msg.user.name !== "You" ? msg.user.avatar : undefined} />
                    <AvatarFallback>
                        {msg.user.name === 'You' ? 'ME' : msg.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                </Avatar>
              <div className={cn("p-3 rounded-lg max-w-[75%]", msg.user.name === "You" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {msg.user.name !== 'You' && <p className="font-bold text-xs mb-1">{msg.user.name}</p>}
                <p className="text-sm">{msg.text}</p>
                <p className="text-xs text-right mt-1 opacity-70">{msg.time}</p>
              </div>
            </div>
          ))}
           {isSending && (
                 <div className="flex items-start gap-3 flex-row-reverse">
                    <Avatar><AvatarFallback>ME</AvatarFallback></Avatar>
                    <div className="p-3 rounded-lg bg-primary text-primary-foreground flex items-center">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                </div>
            )}
        </CardContent>
        <CardFooter className="pt-4 border-t">
          <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
             <Button type="button" variant="ghost" size="icon" onClick={handleFileUpload}>
                <Paperclip className="h-5 w-5" />
             </Button>
            <Textarea
              placeholder="Send a message..."
              className="flex-1 resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              rows={1}
            />
            <Button type="submit" size="icon" disabled={!message.trim() || isSending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
