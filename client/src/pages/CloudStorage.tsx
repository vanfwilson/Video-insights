import { CloudStorageSettings } from "@/components/CloudStorageSettings";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function CloudStorage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Cloud Storage</h1>
            <p className="text-gray-400 text-sm">Connect and manage your cloud storage accounts</p>
          </div>
        </div>
        
        <CloudStorageSettings />
      </div>
    </div>
  );
}
