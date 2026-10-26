#include <Windows.h>
#include <chrono>
#include <thread>
#include <iostream>

void SetWindowOnTop(HWND hwndWindow)
{
    if (IsWindow(hwndWindow)) {
        SetWindowPos(hwndWindow, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
        SetWindowPos(hwndWindow, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
    }
}

int main()
{
    int sleepLength = 500;
    bool setPricePopupOnTop = false;
    bool setPriceListOnTop = false;
    HWND pricePopupHWND = NULL;
    HWND priceListHWND = NULL;
    do {
        if (sleepLength == 550) {
            break;
        }

        if (sleepLength != 500) {
            std::cout << sleepLength;
            std::this_thread::sleep_for(std::chrono::milliseconds(sleepLength));
        }

        if (!IsWindow(pricePopupHWND)) {
            pricePopupHWND = FindWindowA(NULL, "FleaTooltip Popup");

			if (!setPricePopupOnTop && (pricePopupHWND)) {
                setPricePopupOnTop = true;
                SetWindowOnTop(pricePopupHWND);
            }
        }

        if (!IsWindow(priceListHWND)) {
            priceListHWND = FindWindowA(NULL, "FleaTooltip");

            if (!setPriceListOnTop && IsWindow(priceListHWND)) {
                setPriceListOnTop = true;
                SetWindowOnTop(priceListHWND);
            }
        }

        sleepLength += 1;
    } while (!IsWindow(pricePopupHWND) || !IsWindow(priceListHWND));

    //if (foundWindows) {
    //    SetWindowPos(pricePopupHWND, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
    //    SetWindowPos(pricePopupHWND, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);

    //    if (IsWindow(priceListHWND)) {
    //        SetWindowPos(priceListHWND, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
    //        SetWindowPos(priceListHWND, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);

    //        //// 1. Get the screen width
    //        //int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    //        //int screenHeight = GetSystemMetrics(SM_CYSCREEN);

    //        //// 2. Define the fixed dimensions
    //        //const int WINDOW_WIDTH = 450;
    //        //const int WINDOW_HEIGHT = 186;

    //        //// 3. Calculate the new X position for the top-right corner
    //        //// New X = Screen Width - Fixed Window Width
    //        //int newX = screenWidth - WINDOW_WIDTH;
    //        //// New Y is 0 for the top edge
    //        //int newY = screenHeight - WINDOW_HEIGHT - 45;

    //        //// 4. Call SetWindowPos to move, resize, and set Z-order
    //        //SetWindowPos(
    //        //    priceListHWND,  // Handle to your window
    //        //    HWND_TOP,       // Z-order: Make it the top window
    //        //    newX,           // New X position (top-right)
    //        //    newY,           // New Y position (top edge)
    //        //    WINDOW_WIDTH,   // New Width (450)
    //        //    WINDOW_HEIGHT,  // New Height (300)
    //        //    0               // Flags: No flags needed (default behavior is to move and resize)
    //        //);
    //        //SetWindowPos(
    //        //    priceListHWND,  // Handle to your window
    //        //    HWND_TOPMOST,       // Z-order: Make it the top window
    //        //    newX,           // New X position (top-right)
    //        //    newY,           // New Y position (top edge)
    //        //    WINDOW_WIDTH,   // New Width (450)
    //        //    WINDOW_HEIGHT,  // New Height (300)
    //        //    0               // Flags: No flags needed (default behavior is to move and resize)
    //        //);
    //    }
    //}
    /*
    */

    return 0;
}