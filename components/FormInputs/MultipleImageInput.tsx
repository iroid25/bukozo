"use client";

import { UploadButton } from "@/lib/uploadthing";
import { X } from "lucide-react";
import Image from "next/image";

type ImageInputProps = {
  title: string;
  imageUrls: string[];
  setImageUrls: (urls: string[]) => void;
  endpoint: any;
  onRemove?: (index: number) => void;
};

export default function MultipleImageInput({
  title,
  imageUrls,
  setImageUrls,
  endpoint,
  onRemove,
}: ImageInputProps) {
  const handleRemove = (index: number) => {
    if (onRemove) {
      onRemove(index);
    } else {
      setImageUrls(imageUrls.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {imageUrls.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {imageUrls.map((imageUrl: string, i: number) => (
              <div key={i} className="relative group">
                <Image
                  alt={`Product image ${i + 1}`}
                  className="aspect-square w-full h-24 rounded-md object-contain border"
                  height="96"
                  src={imageUrl || "/placeholder.svg"}
                  width="96"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <UploadButton
          className="w-full"
          endpoint={endpoint}
          onClientUploadComplete={(res) => {
            setImageUrls([...imageUrls, ...res.map((item) => item.url)]);
          }}
          onUploadError={(error: Error) => {
            alert(`ERROR! ${error.message}`);
          }}
        />
      </div>
    </div>
  );
}
