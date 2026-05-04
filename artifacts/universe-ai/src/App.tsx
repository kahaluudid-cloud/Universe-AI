import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Sarathi from "@/pages/Sarathi";
import WebCraft from "@/pages/WebCraft";
import Manish from "@/pages/Manish";
import Activity from "@/pages/Activity";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/sarathi" component={Sarathi} />
      <Route path="/sarathi/:id" component={Sarathi} />
      <Route path="/webcraft" component={WebCraft} />
      <Route path="/webcraft/:id" component={WebCraft} />
      <Route path="/manish" component={Manish} />
      <Route path="/manish/:id" component={Manish} />
      <Route path="/activity" component={Activity} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
