#include <iostream>
#include <vector>
#include <stdexcept>
#include <fstream>
#include <memory>
#include <cstring>
#include <tesseract/baseapi.h>
#include <leptonica/allheaders.h>
#include <chrono>
#include <windows.h>
#include <shellscalingapi.h>
#pragma comment(lib, "Shcore.lib")
#include <thread>
#include <stdio.h>
#include <algorithm>
#include <regex>
#include <string>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Configurable border colors (can be overridden via command line arguments)
static short borderColorRed = 82;
static short borderColorGreen = 89;
static short borderColorBlue = 90;

static bool pixelIsBorderColor(short& red, short& green, short& blue) {
    if (red == borderColorRed && green == borderColorGreen && blue == borderColorBlue) {
        return true;
    }

    return false;
}

// BitBlt-based fallback for reading pixels (more reliable with hardware acceleration)
static void LoopThroughPixelsBitBlt(LONG *endOffsetX, LONG *endOffsetY, POINT p) {
    LONG xRange = 20L;
    LONG yRange = 20L;
    LONG xOffsetStarting = 8L;
    LONG yOffsetStarting = -8L;
    POINT lowestPoint{};
    short lowestPointRed = 0;
    short lowestPointGreen = 0;
    short lowestPointBlue = 0;
    LONG matchCount = 0;

    // Calculate the screen region to capture
    LONG captureX = p.x + xOffsetStarting;
    LONG captureY = p.y + yOffsetStarting - yRange + 1;  // Top of the region
    LONG captureWidth = xRange;
    LONG captureHeight = yRange;

    std::cout << "Using BitBlt fallback method..." << std::endl;
    std::cout << "Capturing region from (" << captureX << "," << captureY << ") size " << captureWidth << "x" << captureHeight << std::endl;

    // Get screen DC
    HDC hdcScreen = GetDC(NULL);
    if (hdcScreen == NULL) {
        std::cerr << "ERROR: Failed to get screen device context for BitBlt" << std::endl;
        return;
    }

    // Create memory DC and bitmap
    HDC hdcMem = CreateCompatibleDC(hdcScreen);
    if (hdcMem == NULL) {
        std::cerr << "ERROR: Failed to create compatible DC" << std::endl;
        ReleaseDC(NULL, hdcScreen);
        return;
    }

    HBITMAP hBitmap = CreateCompatibleBitmap(hdcScreen, captureWidth, captureHeight);
    if (hBitmap == NULL) {
        std::cerr << "ERROR: Failed to create compatible bitmap" << std::endl;
        DeleteDC(hdcMem);
        ReleaseDC(NULL, hdcScreen);
        return;
    }

    HGDIOBJ hOldBitmap = SelectObject(hdcMem, hBitmap);

    // Capture the screen region
    if (!BitBlt(hdcMem, 0, 0, captureWidth, captureHeight, hdcScreen, captureX, captureY, SRCCOPY)) {
        std::cerr << "ERROR: BitBlt failed" << std::endl;
        SelectObject(hdcMem, hOldBitmap);
        DeleteObject(hBitmap);
        DeleteDC(hdcMem);
        ReleaseDC(NULL, hdcScreen);
        return;
    }

    // Set up BITMAPINFO for GetDIBits
    BITMAPINFO bmi = {};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = captureWidth;
    bmi.bmiHeader.biHeight = -captureHeight;  // Negative for top-down DIB
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;

    // Allocate buffer for pixel data
    std::vector<BYTE> pixels(captureWidth * captureHeight * 4);

    // Get the pixel data
    if (GetDIBits(hdcMem, hBitmap, 0, captureHeight, pixels.data(), &bmi, DIB_RGB_COLORS) == 0) {
        std::cerr << "ERROR: GetDIBits failed" << std::endl;
        SelectObject(hdcMem, hOldBitmap);
        DeleteObject(hBitmap);
        DeleteDC(hdcMem);
        ReleaseDC(NULL, hdcScreen);
        return;
    }

    // Loop through the captured pixels
    // The loop logic mirrors the original: y goes from 0 down to -yRange (top to bottom in screen coords)
    // In our captured bitmap, y=0 corresponds to captureY, which is the top
    for (LONG y = 0L; y > -1 * yRange; y--) {
        for (LONG x = 0L; x < xRange; x++) {
            // Convert loop coordinates to bitmap coordinates
            // y goes from 0 to -19, which maps to bitmap rows 19 down to 0
            LONG bitmapY = yRange - 1 + y;  // When y=0, bitmapY=19; when y=-19, bitmapY=0
            LONG bitmapX = x;

            // Calculate pixel index (4 bytes per pixel: BGRA)
            LONG pixelIndex = (bitmapY * captureWidth + bitmapX) * 4;

            short blue = pixels[pixelIndex];
            short green = pixels[pixelIndex + 1];
            short red = pixels[pixelIndex + 2];

            // Calculate actual screen coordinates for this pixel
            LONG xRel = x + p.x + xOffsetStarting;
            LONG yRel = y + p.y + yOffsetStarting;

            if (pixelIsBorderColor(red, green, blue)) {
                matchCount++;
                if (lowestPoint.x == 0 || lowestPoint.y == 0 || yRel > lowestPoint.y || (xRel < lowestPoint.x && yRel == lowestPoint.y)) {
                    lowestPoint.x = xRel;
                    lowestPoint.y = yRel;
                    *endOffsetX = x + xOffsetStarting;
                    *endOffsetY = y + yOffsetStarting;
                    lowestPointRed = red;
                    lowestPointGreen = green;
                    lowestPointBlue = blue;
                }
            }
        }
    }

    // Diagnostic output
    std::cout << "BitBlt scanned " << (xRange * yRange) << " pixels successfully" << std::endl;
    std::cout << "Looking for RGB(" << borderColorRed << "," << borderColorGreen << "," << borderColorBlue << ")" << std::endl;
    if (lowestPoint.x != 0 && lowestPoint.y != 0) {
        std::cout << "Found border at (" << lowestPoint.x << "," << lowestPoint.y << ") with RGB(" << lowestPointRed << "," << lowestPointGreen << "," << lowestPointBlue << ")" << std::endl;
    } else {
        std::cout << "No matching border color found in scanned area" << std::endl;
    }

    // Cleanup
    SelectObject(hdcMem, hOldBitmap);
    DeleteObject(hBitmap);
    DeleteDC(hdcMem);
    ReleaseDC(NULL, hdcScreen);
}

static void LoopThroughPixels(LONG *endOffsetX, LONG *endOffsetY) {
    HDC dc = NULL;
    COLORREF color = 0;
    POINT p;
    LONG x = 0L;
    LONG xRel = 0L;
    LONG y = 0L;
    LONG yRel = 0L;
    short red = 0;
    short green = 0;
    short blue = 0;
    LONG xRange = 20L;
    LONG yRange = 20L;
    LONG xOffsetStarting = 8L;
    LONG yOffsetStarting = -8L;
    POINT lowestPoint{};
    short lowestPointRed = 0;
    short lowestPointGreen = 0;
    short lowestPointBlue = 0;
    LONG successCount = 0;
    LONG failureCount = 0;

    if (GetCursorPos(&p)) {
        dc = GetDC(NULL);
        if (dc == NULL) {
            std::cerr << "ERROR: Failed to get device context" << std::endl;
            return;
        }
        std::cout << "Searching from (" << p.x << "," << (p.y - yRange - yOffsetStarting) << ") to (" << (p.x + xRange + xOffsetStarting) << "," << (p.y) << ")" << std::endl;
        for (y = 0L; y > -1*yRange; y--) {
            for (x = 0L; x < xRange; x++) {
                xRel = x + p.x + xOffsetStarting;
                yRel = y + p.y + yOffsetStarting;
                color = GetPixel(dc, xRel, yRel);
                if (color == CLR_INVALID) {
                    // Log first failure to help diagnose
                    if (failureCount == 0) {
                        std::cerr << "WARNING: GetPixel failed at (" << xRel << "," << yRel << ")" << std::endl;
                    }
                    failureCount++;
                    continue;
                }
                successCount++;
                red = GetRValue(color);
                green = GetGValue(color);
                blue = GetBValue(color);

                //std::cout << "DEBUG: Pixel RGB(" << red << "," << green << "," << blue << ")  at x: " << x << ", y: " << y << std::endl;
                
                if (pixelIsBorderColor(red, green, blue)) {
                    if (lowestPoint.x == 0 || lowestPoint.y == 0 || yRel > lowestPoint.y || (xRel < lowestPoint.x && yRel == lowestPoint.y)) {
                        lowestPoint.x = xRel;
                        lowestPoint.y = yRel;
                        *endOffsetX = x + xOffsetStarting;
                        *endOffsetY = y + yOffsetStarting;
                        lowestPointRed = red;
                        lowestPointGreen = green;
                        lowestPointBlue = blue;
                    }
                }
            }
        }

        // Diagnostic output
        //std::cout << "Scanned " << successCount << " pixels, " << failureCount << " failed" << std::endl;
        //std::cout << "Looking for RGB(" << borderColorRed << "," << borderColorGreen << "," << borderColorBlue << ")" << std::endl;
        /*if (lowestPoint.x != 0 && lowestPoint.y != 0) {
            std::cout << "Found border at (" << lowestPoint.x << "," << lowestPoint.y << ") with RGB(" << lowestPointRed << "," << lowestPointGreen << "," << lowestPointBlue << ")" << std::endl;
        } else {
            std::cout << "No matching border color found in scanned area" << std::endl;
        }*/

        ReleaseDC(NULL, dc);

        // If GetPixel failed for most pixels, retry with BitBlt fallback
        LONG totalPixels = xRange * yRange;
        if (failureCount > totalPixels / 2) {
            std::cerr << "WARNING: GetPixel failed for " << failureCount << "/" << totalPixels << " pixels. Retrying with BitBlt..." << std::endl;
            LoopThroughPixelsBitBlt(endOffsetX, endOffsetY, p);
        }
    }
}

int main(int argc, char* argv[])
{
    // Set DPI awareness to ensure cursor coordinates match actual screen pixels
    SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);

    // Parse optional command line arguments for border colors: red green blue
    if (argc >= 4) {
        try {
            borderColorRed = static_cast<short>(std::stoi(argv[1]));
            borderColorGreen = static_cast<short>(std::stoi(argv[2]));
            borderColorBlue = static_cast<short>(std::stoi(argv[3]));
        }
        catch (const std::exception& e) {
            std::cerr << "Error parsing color arguments. Using default values." << std::endl;
        }
    }

    LONG endOffsetX = 0L;
    LONG endOffsetY = 0L;
    std::string userInput = "";

    std::cout << "HOVER OVER ITEM WITH ONE ROW" << std::endl;
    fflush(stdout);
    do {
        std::getline(std::cin, userInput);
		if (userInput == "EXIT") {
            return 0;
        }
    } while (userInput != "NEXT");
    userInput = "";

    LoopThroughPixels(&endOffsetX, &endOffsetY);

    std::cout << "RESULT||" << endOffsetX << "||" << endOffsetY << std::endl;
    return 0;
}