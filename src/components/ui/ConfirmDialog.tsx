"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md scrollbar-hide">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {variant === "destructive" ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 flex-shrink-0">
                <Trash2 className="h-6 w-6 text-blue-600" />
              </div>
            )}
            <div className="flex-1">
              <DialogTitle className="text-left text-lg font-semibold text-gray-900">
                {title}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>
        
        <div className="mt-4 ml-16">
          <DialogDescription className="text-left text-gray-600 leading-relaxed">
            {description}
          </DialogDescription>
        </div>

        <DialogFooter className="flex gap-3 mt-8 ml-16">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="cursor-pointer flex-1 sm:flex-none"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isLoading}
            className="cursor-pointer flex-1 sm:flex-none flex items-center gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}