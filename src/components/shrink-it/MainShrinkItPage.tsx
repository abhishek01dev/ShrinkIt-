// src/components/shrink-it/MainShrinkItPage.tsx
"use client";

import React, { useState, useCallback } from 'react';
import NextImage from 'next/image'; // Renamed to avoid conflict with HTMLImageElement
import { removeImageBackground, type RemoveImageBackgroundInput } from '@/ai/flows/remove-image-background';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Loader2, UploadCloud, Download, AlertCircle, Image as ImageIcon, Link, Unlink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { resizeAndCompressImage } from '@/lib/image-processing';

export default function MainShrinkItPage() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalImageDataUrl, setOriginalImageDataUrl] = useState<string | null>(null);
  const [processedImageDataUrl, setProcessedImageDataUrl] = useState<string | null>(null);
  
  const [targetWidth, setTargetWidth] = useState<number>(0);
  const [targetHeight, setTargetHeight] = useState<number>(0);
  const [originalWidth, setOriginalWidth] = useState<number>(0);
  const [originalHeight, setOriginalHeight] = useState<number>(0);
  const [aspectRatioLocked, setAspectRatioLocked] = useState<boolean>(true);

  const [quality, setQuality] = useState<number>(80);
  const [removeBg, setRemoveBg] = useState<boolean>(false);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  const resetStateForNewImage = () => {
    setProcessedImageDataUrl(null);
    setError(null);
    // setRemoveBg(false); // Optionally reset controls
    // setQuality(80);
    // setAspectRatioLocked(true); // Keep aspect lock preference or reset? For now, keep.
  };

  const setupOriginalImage = useCallback((file: File) => {
    resetStateForNewImage();
    setOriginalFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setOriginalImageDataUrl(dataUrl);
      const img = new window.Image(); // Use window.Image to avoid conflict
      img.onload = () => {
        const natWidth = img.naturalWidth;
        const natHeight = img.naturalHeight;
        setOriginalWidth(natWidth);
        setOriginalHeight(natHeight);
        setTargetWidth(natWidth);
        setTargetHeight(natHeight);
      };
      img.onerror = () => {
        setError("Could not load image dimensions.");
        toast({ title: "Error", description: "Could not load image dimensions.", variant: "destructive" });
      }
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setError("Failed to read file.");
      toast({ title: "Error", description: "Failed to read file.", variant: "destructive" });
    }
    reader.readAsDataURL(file);
  }, [toast]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setupOriginalImage(file);
      } else {
        setError("Invalid file type. Please upload an image.");
        toast({ title: "Error", description: "Invalid file type. Please upload an image.", variant: "destructive" });
      }
    }
    // Reset file input value to allow re-uploading the same file
    event.target.value = ''; 
  }, [setupOriginalImage, toast]);
  
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isProcessing) return;
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setupOriginalImage(file);
      } else {
        setError("Invalid file type. Please upload an image.");
        toast({ title: "Error", description: "Invalid file type. Please upload an image.", variant: "destructive" });
      }
      event.dataTransfer.clearData();
    }
  }, [setupOriginalImage, toast, isProcessing]);

  const handleWidthChange = (value: string) => {
    const newWidth = Math.max(1, parseInt(value, 10) || 1);
    setTargetWidth(newWidth);
    if (aspectRatioLocked && originalWidth > 0 && originalHeight > 0) {
      const newHeight = Math.round((newWidth / originalWidth) * originalHeight);
      setTargetHeight(Math.max(1, newHeight));
    }
  };

  const handleHeightChange = (value: string) => {
    const newHeight = Math.max(1, parseInt(value, 10) || 1);
    setTargetHeight(newHeight);
    if (aspectRatioLocked && originalWidth > 0 && originalHeight > 0) {
      const newWidth = Math.round((newHeight / originalHeight) * originalWidth);
      setTargetWidth(Math.max(1, newWidth));
    }
  };

  const handleProcessImage = async () => {
    if (!originalFile) {
      setError("Please upload an image first.");
      toast({ title: "Error", description: "Please upload an image first.", variant: "destructive" });
      return;
    }
    if (targetWidth <= 0 || targetHeight <= 0) {
      setError("Width and Height must be positive values.");
      toast({ title: "Error", description: "Width and Height must be positive values.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessedImageDataUrl(null); // Clear previous processed image preview

    try {
      toast({ title: "Processing", description: "Compressing image..." });
      let currentImageDataUrl = await resizeAndCompressImage(originalFile, targetWidth, targetHeight, quality);
      
      if (removeBg) {
        toast({ title: "Processing", description: "Removing background (AI)... This may take a moment." });
        const removeBgInput: RemoveImageBackgroundInput = { photoDataUri: currentImageDataUrl };
        const result = await removeImageBackground(removeBgInput);
        currentImageDataUrl = result.processedPhotoDataUri;
      }
      
      setProcessedImageDataUrl(currentImageDataUrl);
      toast({ title: "Success!", description: "Image processed successfully." });
    } catch (err) {
      console.error("Processing error:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during processing.";
      setError(errorMessage);
      toast({ title: "Processing Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedImageDataUrl) return;
    const link = document.createElement('a');
    link.href = processedImageDataUrl;
    const fileExtension = processedImageDataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const originalName = originalFile?.name.substring(0, originalFile.name.lastIndexOf('.')) || 'image';
    link.download = `${originalName}_shrinkit.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Download Started", description: "Your processed image is downloading." });
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="container mx-auto px-4 py-8 md:px-8 md:py-12 min-h-screen flex flex-col items-center">
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">ShrinkIt</h1>
        <p className="text-lg text-muted-foreground mt-2">Optimize your images with ease.</p>
      </header>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <UploadCloud className="text-primary" /> Image Upload & Settings
            </CardTitle>
            <CardDescription>Upload your image and configure compression options.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div 
              className={`border-2 border-dashed border-border rounded-lg p-6 py-10 text-center transition-all duration-300 ease-in-out bg-background ${isProcessing ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-primary focus-within:border-primary hover:bg-primary/5'}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => !isProcessing && document.getElementById('fileInput')?.click()}
              tabIndex={isProcessing ? -1 : 0}
              onKeyDown={(e) => { if (!isProcessing && (e.key === 'Enter' || e.key === ' ')) document.getElementById('fileInput')?.click();}}
              role="button"
              aria-label="Image upload area"
              aria-disabled={isProcessing}
            >
              <input 
                type="file" 
                id="fileInput"
                className="hidden" 
                accept="image/png, image/jpeg, image/webp, image/gif" 
                onChange={handleFileChange} 
                disabled={isProcessing}
              />
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="font-semibold text-foreground">Drag & drop image here, or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">Supports PNG, JPG, GIF, WEBP</p>
              {originalFile && <p className="text-sm text-accent mt-2 font-medium">Selected: {originalFile.name}</p>}
            </div>

            {originalFile && (
              <>
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Dimensions (Pixels)</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="width" className="text-sm">Width</Label>
                      <Input 
                        id="width" 
                        type="number" 
                        value={targetWidth} 
                        onChange={(e) => handleWidthChange(e.target.value)} 
                        min="1"
                        disabled={isProcessing}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="height" className="text-sm">Height</Label>
                      <Input 
                        id="height" 
                        type="number" 
                        value={targetHeight} 
                        onChange={(e) => handleHeightChange(e.target.value)} 
                        min="1"
                        disabled={isProcessing}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {(originalWidth > 0 && originalHeight > 0) && (
                    <p className="text-xs text-muted-foreground">Original: {originalWidth}x{originalHeight} px</p>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <Label htmlFor="aspectRatioLock" className="flex items-center gap-2 text-sm cursor-pointer">
                      {aspectRatioLocked ? <Link className="h-4 w-4 text-accent" /> : <Unlink className="h-4 w-4 text-muted-foreground" />}
                      Lock Aspect Ratio
                    </Label>
                    <Switch 
                      id="aspectRatioLock"
                      checked={aspectRatioLocked}
                      onCheckedChange={setAspectRatioLocked}
                      disabled={isProcessing || !(originalWidth > 0 && originalHeight > 0)}
                      className="data-[state=checked]:bg-accent"
                      aria-label="Toggle aspect ratio lock"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="quality" className="text-base font-semibold">JPEG Quality ({quality}%)</Label>
                  <Slider 
                    id="quality"
                    min={1} 
                    max={100} 
                    step={1} 
                    value={[quality]} 
                    onValueChange={(value) => setQuality(value[0])} 
                    disabled={isProcessing}
                    className="mt-1 py-2 accent-slider"
                    aria-label={`JPEG Quality ${quality}%`}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                  <Label htmlFor="removeBg" className="flex flex-col cursor-pointer">
                    <span className="text-base font-semibold">Remove Background (AI)</span>
                    <span className="text-xs text-muted-foreground">Powered by GenAI. Processing may take longer.</span>
                  </Label>
                  <Switch 
                    id="removeBg" 
                    checked={removeBg} 
                    onCheckedChange={setRemoveBg} 
                    disabled={isProcessing}
                    className="data-[state=checked]:bg-accent"
                    aria-label="Toggle background removal"
                  />
                </div>
              </>
            )}
            
            {error && (
              <div role="alert" className="text-destructive text-sm flex items-center gap-2 p-3 bg-destructive/10 rounded-md border border-destructive/30">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}
          </CardContent>
          {originalFile && (
            <CardFooter>
              <Button 
                onClick={handleProcessImage} 
                disabled={isProcessing || !originalFile} 
                className="w-full text-lg py-6 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 ease-in-out transform hover:scale-105"
                size="lg"
              >
                {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {isProcessing ? 'Processing...' : 'Process Image'}
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ImageIcon className="text-accent"/> Image Preview
            </CardTitle>
            <CardDescription>Review your original and processed images.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Original Image</h3>
              <div className="relative w-full aspect-[16/10] border border-border rounded-md overflow-hidden bg-muted/20 flex items-center justify-center p-2">
                {originalImageDataUrl ? (
                  <NextImage src={originalImageDataUrl} alt="Original preview" layout="fill" objectFit="contain" data-ai-hint="uploaded photo" />
                ) : (
                  <p className="text-muted-foreground text-center">Upload an image to see the original preview</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Processed Image</h3>
              <div className="relative w-full aspect-[16/10] border border-border rounded-md overflow-hidden bg-muted/20 flex items-center justify-center p-2">
                {isProcessing ? (
                   <div className="text-center">
                      <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary mb-2" />
                      <p className="text-muted-foreground">Processing, please wait...</p>
                    </div>
                ) : processedImageDataUrl ? (
                  <NextImage src={processedImageDataUrl} alt="Processed preview" layout="fill" objectFit="contain" data-ai-hint="processed result" />
                ) : (
                  <p className="text-muted-foreground text-center">
                    {originalFile ? 'Adjust settings and click "Process Image"' : 'Processed image will appear here'}
                  </p>
                )}
              </div>
            </div>
            
            {processedImageDataUrl && !isProcessing && (
              <Button 
                onClick={handleDownload} 
                className="w-full text-lg py-6 bg-accent hover:bg-accent/90 text-accent-foreground transition-all duration-300 ease-in-out transform hover:scale-105"
                size="lg"
              >
                <Download className="mr-2 h-5 w-5" />
                Download Processed Image
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} ShrinkIt. Crafted with care.</p>
      </footer>
      <style jsx global>{`
        .accent-slider > span[role="slider"] {
          background-color: hsl(var(--accent));
          border-color: hsl(var(--accent));
          box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--accent));
        }
        .accent-slider > span[role="slider"]:focus-visible {
           box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring));
        }
        .accent-slider > div { /* Track */
          background-color: hsl(var(--accent) / 0.2);
        }
        .accent-slider > div > span { /* Range */
           background-color: hsl(var(--accent));
        }
      `}</style>
    </div>
  );
}

