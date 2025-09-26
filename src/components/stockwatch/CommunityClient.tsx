
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
import { ArrowLeft, Send, Paperclip, Loader2, User as UserIcon, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Message {
  id: number;
  created_at: string;
  content: string;
  user_id: string;
  user_name: string;
}

const isMissingTableError = (errorMessage: string) => {
    return errorMessage.includes("relation \"public.messages\" does not exist") || errorMessage.includes("Could not find the table 'public.messages'");
}

const defaultWelcomeMessage: Message = {
    id: 0,
    created_at: new Date().toISOString(),
    content: "Hi everyone! Welcome to the community chat. Feel free to discuss stocks, strategies, and market news.",
    user_id: "admin",
    user_name: "Admin"
};


export function CommunityClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUserAndMessages = async () => {
      setIsLoading(true);
      setDbError(null);
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

      if (messagesError && messagesError.message) {
        if (isMissingTableError(messagesError.message)) {
            setDbError("The 'messages' table is not set up in your database. Please run the SQL code in `src/lib/supabase/schema.sql` in your Supabase SQL Editor to create the table and enable the chat feature.");
        } else {
            toast({
              variant: 'destructive',
              title: 'Error fetching messages',
              description: messagesError.message,
            });
        }
        console.error("Error fetching messages:", messagesError);
      } else {
        if (initialMessages && initialMessages.length > 0) {
            setMessages(initialMessages);
        } else {
            setMessages([defaultWelcomeMessage]);
        }
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
            setMessages((prevMessages) => {
                // If the only message is the default one, replace it
                if (prevMessages.length === 1 && prevMessages[0].id === 0) {
                    return [payload.new];
                }
                return [...prevMessages, payload.new];
            });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
            console.log('Connected to messages channel');
        }
        if (status === 'CHANNEL_ERROR' || err) {
            const errorMessage = (err as any)?.message || 'An unknown error occurred.';
            if (isMissingTableError(errorMessage)) {
                 setDbError("The 'messages' table is not set up in your database. Please run the SQL code in `src/lib/supabase/schema.sql` in your Supabase SQL Editor to create the table and enable the chat feature.");
            }
        }
      });

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
      if (isMissingTableError(error.message)) {
        setDbError("The 'messages' table is not set up in your database. Please run the SQL code in `src/lib/supabase/schema.sql` in your Supabase SQL Editor to create the table and enable the chat feature.");
      } else {
        toast({ variant: 'destructive', title: 'Could not send message', description: error.message });
      }
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
          ) : dbError ? (
             <div className="flex h-full items-center justify-center">
                <Alert variant="destructive" className="max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Database Setup Required</AlertTitle>
                    <AlertDescription>
                        {dbError}
                    </AlertDescription>
                </Alert>
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
             <Button type="button" variant="ghost" size="icon" onClick={handleFileUpload} disabled={!!dbError}>
                <Paperclip className="h-5 w-5" />
             </Button>
            <Textarea
              placeholder={dbError ? "Database connection failed" : "Send a message..."}
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
              disabled={!!dbError}
            />
            <Button type="submit" size="icon" disabled={!message.trim() || isSending || !!dbError}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
