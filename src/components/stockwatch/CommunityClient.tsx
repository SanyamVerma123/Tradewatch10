
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
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Message {
  id: number;
  created_at: string;
  content: string;
  user_id: string;
  user_name: string;
}

export function CommunityClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUserAndMessages = async () => {
      setIsLoading(true);
      const { data: { user: sbUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !sbUser) {
        router.replace('/');
        return;
      }
      setUser(sbUser);

      const { data: initialMessages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (messagesError) {
        toast({
          variant: 'destructive',
          title: 'Error fetching messages',
          description: 'Could not load chat history. Please ensure the \'messages\' table is created in Supabase.',
        });
        console.error("Error fetching messages:", messagesError);
      } else {
        setMessages(initialMessages || []);
      }
      setIsLoading(false);
    };

    fetchUserAndMessages();

    const channel = supabase
      .channel('public:messages')
      .on<Message>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prevMessages) => [...prevMessages, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, toast]);


  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;

    setIsSending(true);

    const { error } = await supabase.from('messages').insert({
      content: message.trim(),
      user_id: user.id,
      user_name: user.user_metadata.full_name || 'Anonymous',
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Could not send message', description: error.message });
    } else {
      setMessage("");
    }
    
    setIsSending(false);
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
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={cn("flex items-start gap-3", msg.user_id === user?.id ? "flex-row-reverse" : "")}>
                  <Avatar>
                      <AvatarImage src={undefined} />
                      <AvatarFallback>
                          {msg.user_id === user?.id ? 'ME' : (msg.user_name || 'U').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                  </Avatar>
                <div className={cn("p-3 rounded-lg max-w-[75%]", msg.user_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {msg.user_id !== user?.id && <p className="font-bold text-xs mb-1">{msg.user_name}</p>}
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-xs text-right mt-1 opacity-70">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))
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
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
