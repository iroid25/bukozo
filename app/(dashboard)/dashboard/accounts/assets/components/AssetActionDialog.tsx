"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AssetDisposalForm, type AssetDisposalTarget } from "./AssetDisposalForm";
import { CurrentAssetTransferForm } from "./CurrentAssetTransferForm";

type AssetActionTab = "transfer" | "dispose";

type FixedAssetOption = {
  id: string;
  assetCode: string;
  assetName: string;
  assetType?: string;
  status: string;
  currentValue?: number | null;
  purchasePrice?: number | null;
};

interface AssetActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialTab?: AssetActionTab;
  disposalAsset?: AssetDisposalTarget | null;
}

export function AssetActionDialog({
  isOpen,
  onClose,
  onSuccess,
  initialTab = "transfer",
  disposalAsset = null,
}: AssetActionDialogProps) {
  const [activeTab, setActiveTab] = useState<AssetActionTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [disposalAsset?.id, initialTab, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-black tracking-tight">
            Asset Actions
          </DialogTitle>
          <DialogDescription className="max-w-2xl text-sm">
            Transfer approved current assets or record fixed asset disposals
            from one place, with a cleaner picker experience and better asset
            visibility.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as AssetActionTab)}
          className="w-full"
        >
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-muted/30 p-1">
            <TabsTrigger
              value="transfer"
              className="flex h-12 flex-col items-center justify-center gap-1 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <span className="text-sm font-semibold">Transfer Current Asset</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                Current
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="dispose"
              className="flex h-12 flex-col items-center justify-center gap-1 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <span className="text-sm font-semibold">Dispose Fixed Asset</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                Fixed
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transfer" className="mt-6">
            <CurrentAssetTransferForm
              isOpen={isOpen}
              onClose={onClose}
              onSuccess={onSuccess}
              embedded
            />
          </TabsContent>

          <TabsContent value="dispose" className="mt-6 space-y-4">
            <AssetDisposalForm
              isOpen={isOpen}
              asset={disposalAsset}
              onClose={onClose}
              onSuccess={onSuccess}
              embedded
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
