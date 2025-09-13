
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Sparkles, Loader2, Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupportResponse } from "@/ai/flows/support-flow";
import { cn } from "@/lib/utils";

interface Message {
  role: 'user' | 'bot';
  content: string;
}

export function SupportClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentQuery = query.trim();
    if (!currentQuery || isLoading) return;

    const userMessage: Message = { role: 'user', content: currentQuery };
    
    setMessages(prev => [...prev, userMessage]);
    setQuery("");
    setIsLoading(true);

    try {
      const response = await getSupportResponse(currentQuery);
      const botMessage: Message = { role: 'bot', content: response };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("AI support error:", error);
      const errorMessage: Message = { role: 'bot', content: "I'm sorry, I'm having trouble connecting right now. Please try again later." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold">Support</h1>
      </header>
      
      <Card className="flex flex-col h-[70vh]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Support Assistant
          </CardTitle>
          <CardDescription>
            Ask me anything about how to use the StockImage app.
          </CardDescription>
        </CardHeader>
        <CardContent ref={scrollAreaRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <Bot className="h-12 w-12 mb-4" />
                    <p>Welcome! How can I help you navigate the app today?</p>
                    <p className="text-xs mt-2">e.g., "How do I place a limit order?"</p>
                </div>
            ) : (
                messages.map((message, index) => (
                    <div key={index} className={cn("flex items-start gap-3", message.role === 'user' ? 'justify-end' : 'justify-start')}>
                        {message.role === 'bot' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center"><Bot className="h-5 w-5 text-primary" /></div>}
                        <div className={cn("p-3 rounded-lg max-w-[80%]", message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                    </div>
                ))
            )}
            {isLoading && (
                 <div className="flex items-start gap-3 justify-start">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center"><Bot className="h-5 w-5 text-primary" /></div>
                    <div className="p-3 rounded-lg bg-muted flex items-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                </div>
            )}
        </CardContent>
        <CardFooter className="pt-4 border-t">
          <form onSubmit={handleQuerySubmit} className="flex w-full items-center gap-2">
            <Textarea
              placeholder="Ask about features, orders, portfolio, etc."
              className="flex-1 resize-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleQuerySubmit(e);
                }
              }}
              rows={1}
            />
            <Button type="submit" size="icon" disabled={!query.trim() || isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
