#include <iostream>
#include <vector>
#include <stdexcept>
#include <fstream>
#include <memory>
#include <cstring>
#include <filesystem>
#include <sstream>
#include <iomanip>
#include <chrono>
#define NOMINMAX
#include <windows.h>
#include <shellscalingapi.h>
#pragma comment(lib, "Shcore.lib")
#include <thread>
#include <stdio.h>
#include <algorithm>
#include <regex>
#include <string>
#include <nlohmann/json.hpp>

using namespace std;
using json = nlohmann::json;

// Configurable border color (can be overridden via command line arguments)
static short borderColorRed = 82;
static short borderColorGreen = 89;
static short borderColorBlue = 90;

// Pre-compiled regex patterns for performance
static const std::regex regexNewlineCRLF("\r\n");
static const std::regex regexNewlineLF("\n");
static const std::regex regexAtSymbol("@");

// Cached desktop DC (optimization #2)
static HDC cachedDesktopDC = NULL;
static HWND cachedDesktopWindow = NULL;

// Pixel buffer cache for batch reading (optimization #1)
struct PixelBuffer {
	vector<uint8_t> pixels;
	int x, y, width, height;
	int bytesPerPixel;
	int bytesPerScanLine;
	
	PixelBuffer() : x(0), y(0), width(0), height(0), bytesPerPixel(4), bytesPerScanLine(0) {}
};

static PixelBuffer cachedPixelBuffer;

class Image
{
private:
	vector<uint8_t> Pixels;
	uint32_t width, height;
	uint16_t BitsPerPixel;

	void Flip(void* In, void* Out, int width, int height, unsigned int Bpp);

public:
	explicit Image(HDC DC, int X, int Y, int Width, int Height);

	inline uint16_t GetBitsPerPixel() { return this->BitsPerPixel; }
	inline uint16_t GetBytesPerPixel() { return this->BitsPerPixel / 8; }
	inline uint16_t GetBytesPerScanLine() { return (this->BitsPerPixel / 8) * this->width; }
	inline int GetWidth() const { return this->width; }
	inline int GetHeight() const { return this->height; }
	inline const uint8_t* GetPixels() { return this->Pixels.data(); }
};

void Image::Flip(void* In, void* Out, int width, int height, unsigned int Bpp)
{
	unsigned long Chunk = (Bpp > 24 ? width * 4 : width * 3 + width % 4);
	unsigned char* Destination = static_cast<unsigned char*>(Out);
	unsigned char* Source = static_cast<unsigned char*>(In) + Chunk * (height - 1);

	while (Source != In)
	{
		memcpy(Destination, Source, Chunk);
		Destination += Chunk;
		Source -= Chunk;
	}
}

Image::Image(HDC DC, int X, int Y, int Width, int Height) : Pixels(), width(Width), height(Height), BitsPerPixel(32)
{
	BITMAP Bmp = { 0 };
	HBITMAP hBmp = reinterpret_cast<HBITMAP>(GetCurrentObject(DC, OBJ_BITMAP));

	if (GetObject(hBmp, sizeof(BITMAP), &Bmp) == 0)
		throw runtime_error("BITMAP DC NOT FOUND.");

	RECT area = { X, Y, X + Width, Y + Height };
	HWND Window = WindowFromDC(DC);
	GetClientRect(Window, &area);

	HDC MemDC = GetDC(nullptr);
	HDC SDC = CreateCompatibleDC(MemDC);
	HBITMAP hSBmp = CreateCompatibleBitmap(MemDC, width, height);
	DeleteObject(SelectObject(SDC, hSBmp));

	BitBlt(SDC, 0, 0, width, height, DC, X, Y, SRCCOPY);
	unsigned int data_size = ((width * BitsPerPixel + 31) / 32) * 4 * height;
	vector<uint8_t> Data(data_size);
	this->Pixels.resize(data_size);

	BITMAPINFO Info = { sizeof(BITMAPINFOHEADER), static_cast<long>(width), static_cast<long>(height), 1, BitsPerPixel, BI_RGB, data_size, 0, 0, 0, 0 };
	GetDIBits(SDC, hSBmp, 0, height, &Data[0], &Info, DIB_RGB_COLORS);
	this->Flip(&Data[0], &Pixels[0], width, height, BitsPerPixel);

	DeleteDC(SDC);
	DeleteObject(hSBmp);
	ReleaseDC(nullptr, MemDC);
}

static bool pixelIsBorderColor(short& red, short& green, short& blue) {
	if (red == borderColorRed && green == borderColorGreen && blue == borderColorBlue) {
		return true;
	}

	return false;
}

// Capture a pixel region to buffer for fast access (optimization #1)
static bool capturePixelRegion(HDC dc, int x, int y, int width, int height, bool forceRecapture = false) {
	// Check if we need to recapture (only skip if same region and not forced)
	if (!forceRecapture && cachedPixelBuffer.x == x && cachedPixelBuffer.y == y && 
		cachedPixelBuffer.width == width && cachedPixelBuffer.height == height &&
		!cachedPixelBuffer.pixels.empty()) {
		return true; // Already have this region cached
	}

	cachedPixelBuffer.x = x;
	cachedPixelBuffer.y = y;
	cachedPixelBuffer.width = width;
	cachedPixelBuffer.height = height;
	cachedPixelBuffer.bytesPerPixel = 4; // 32-bit RGB
	cachedPixelBuffer.bytesPerScanLine = ((width * 32 + 31) / 32) * 4;

	unsigned int data_size = cachedPixelBuffer.bytesPerScanLine * height;
	cachedPixelBuffer.pixels.resize(data_size);

	HDC MemDC = GetDC(nullptr);
	if (MemDC == NULL) {
		cerr << "ERROR: Failed to get memory device context" << endl;
		cachedPixelBuffer.pixels.clear();
		return false;
	}

	HDC SDC = CreateCompatibleDC(MemDC);
	if (SDC == NULL) {
		cerr << "ERROR: Failed to create compatible DC" << endl;
		ReleaseDC(nullptr, MemDC);
		cachedPixelBuffer.pixels.clear();
		return false;
	}

	HBITMAP hSBmp = CreateCompatibleBitmap(MemDC, width, height);
	if (hSBmp == NULL) {
		cerr << "ERROR: Failed to create compatible bitmap" << endl;
		DeleteDC(SDC);
		ReleaseDC(nullptr, MemDC);
		cachedPixelBuffer.pixels.clear();
		return false;
	}

	DeleteObject(SelectObject(SDC, hSBmp));

	if (!BitBlt(SDC, 0, 0, width, height, dc, x, y, SRCCOPY)) {
		cerr << "ERROR: BitBlt failed during pixel capture" << endl;
		DeleteDC(SDC);
		DeleteObject(hSBmp);
		ReleaseDC(nullptr, MemDC);
		cachedPixelBuffer.pixels.clear();
		return false;
	}

	BITMAPINFO Info = { sizeof(BITMAPINFOHEADER), static_cast<long>(width), static_cast<long>(height), 1, 32, BI_RGB, data_size, 0, 0, 0, 0 };
	if (GetDIBits(SDC, hSBmp, 0, height, cachedPixelBuffer.pixels.data(), &Info, DIB_RGB_COLORS) == 0) {
		cerr << "ERROR: GetDIBits failed during pixel capture" << endl;
		DeleteDC(SDC);
		DeleteObject(hSBmp);
		ReleaseDC(nullptr, MemDC);
		cachedPixelBuffer.pixels.clear();
		return false;
	}

	// Flip the image (Windows bitmaps are bottom-up)
	unsigned long Chunk = cachedPixelBuffer.bytesPerScanLine;
	vector<uint8_t> flipped(data_size);
	unsigned char* Destination = flipped.data();
	unsigned char* Source = cachedPixelBuffer.pixels.data() + Chunk * (height - 1);

	while (Source >= cachedPixelBuffer.pixels.data()) {
		memcpy(Destination, Source, Chunk);
		Destination += Chunk;
		Source -= Chunk;
	}
	cachedPixelBuffer.pixels = std::move(flipped);

	DeleteDC(SDC);
	DeleteObject(hSBmp);
	ReleaseDC(nullptr, MemDC);
	return true;
}

// Read pixel from cached buffer (optimization #1)
static bool getPixelFromBuffer(int x, int y, short& red, short& green, short& blue) {
	// Check if pixel is within cached region
	int relX = x - cachedPixelBuffer.x;
	int relY = y - cachedPixelBuffer.y;

	if (relX < 0 || relY < 0 || relX >= cachedPixelBuffer.width || relY >= cachedPixelBuffer.height) {
		return false; // Pixel not in cached region
	}

	// Calculate offset in buffer (BGRA format, bottom-up was flipped to top-down)
	int offset = (relY * cachedPixelBuffer.bytesPerScanLine) + (relX * cachedPixelBuffer.bytesPerPixel);
	
	if (offset + 2 >= static_cast<int>(cachedPixelBuffer.pixels.size())) {
		return false;
	}

	// Windows DIB is BGRA format
	blue = cachedPixelBuffer.pixels[offset];
	green = cachedPixelBuffer.pixels[offset + 1];
	red = cachedPixelBuffer.pixels[offset + 2];

	return true;
}

static bool pixelIsValid(short startingX, short startingY, short& red, short& green, short& blue, short offsetX = 0, short offsetY = 0) {
	LONG x = startingX + offsetX;
	LONG y = startingY + offsetY;

	// Try to read from cached buffer first
	if (getPixelFromBuffer(x, y, red, green, blue)) {
		return pixelIsBorderColor(red, green, blue);
	}

	// Fallback to GetPixel if not in cache (shouldn't happen with proper caching)
	if (cachedDesktopDC) {
		COLORREF color = GetPixel(cachedDesktopDC, x, y);
		if (color == CLR_INVALID) {
			// GetPixel failed - could be due to hardware acceleration or other issues
			return false;
		}
		red = GetRValue(color);
		green = GetGValue(color);
		blue = GetBValue(color);
		return pixelIsBorderColor(red, green, blue);
	}

	return false;
}

// v1.1.5: The bottom border stays near the pointer's calibrated Y even
// when Tarkov slides the entire tooltip LEFT. A pixel on that line is not
// necessarily the bottom-LEFT corner. Start by checking just X=-13..+13
// relative to the mouse, then trace BOTH directions to recover the corners.
//
// The initial 27px check uses a tiny bitmap. Only after it sees a border
// pixel do we capture a larger rectangle for border tracing/validation.
struct TooltipRect {
    int left, top, right, bottom;
};

static bool detectTooltipByBottomBorder(
    HDC dc, const POINT& mouse, int calibratedBottomY,
    const RECT& monitorRect, TooltipRect& result, bool& sawSeed)
{
    sawSeed = false;
    const int seedMinX = std::max(static_cast<int>(monitorRect.left),
                                  static_cast<int>(mouse.x) - 13);
    const int seedMaxX = std::min(static_cast<int>(monitorRect.right) - 1,
                                  static_cast<int>(mouse.x) + 13);
    const int smallY = std::max(static_cast<int>(monitorRect.top),
                                calibratedBottomY - 2);
    const int smallBottom = std::min(static_cast<int>(monitorRect.bottom) - 1,
                                     calibratedBottomY + 2);
    if (seedMaxX < seedMinX || smallBottom < smallY) return false;
    if (!capturePixelRegion(dc, seedMinX, smallY, seedMaxX - seedMinX + 1,
                            smallBottom - smallY + 1, true)) return false;

    // A few pixels of Y tolerance accommodates border anti-aliasing while
    // retaining calibrated Y as the anchor (NOT an unbounded vertical search).
    std::vector<POINT> seeds;
    for (int dy : {0, -1, 1, -2, 2}) {
        const int y = calibratedBottomY + dy;
        if (y < smallY || y > smallBottom) continue;
        for (int x = seedMinX; x <= seedMaxX; ++x) {
            short r=0,g=0,b=0;
            if (pixelIsValid(static_cast<short>(x), static_cast<short>(y), r,g,b))
                seeds.push_back(POINT{static_cast<LONG>(x), static_cast<LONG>(y)});
        }
    }
    if (seeds.empty()) return false;
    sawSeed = true;

    // Needs the full horizontal border on BOTH sides of the cursor.
    // Capture this only for seed hits; constrain to current monitor.
    const int wideX = std::max(static_cast<int>(monitorRect.left),
                                static_cast<int>(mouse.x) - 750);
    const int wideRight = std::min(static_cast<int>(monitorRect.right),
                                   static_cast<int>(mouse.x) + 750);
    const int wideY = std::max(static_cast<int>(monitorRect.top),
                               calibratedBottomY - 165);
    const int wideBottom = std::min(static_cast<int>(monitorRect.bottom),
                                    calibratedBottomY + 8);
    if (wideRight - wideX < 65 || wideBottom - wideY < 35) return false;
    if (!capturePixelRegion(dc,wideX,wideY,
                            wideRight-wideX,wideBottom-wideY,true)) return false;

    auto border = [&](int x,int y) {
        if (x < wideX || x >= wideRight || y < wideY || y >= wideBottom ||
            x < SHRT_MIN || x > SHRT_MAX || y < SHRT_MIN || y > SHRT_MAX) return false;
        short r=0,g=0,b=0;
        return pixelIsValid(static_cast<short>(x),static_cast<short>(y),r,g,b);
    };
    auto horizontalEdge = [&](int seedX,int y,int direction) {
        int last = seedX;
        int missed = 0;
        for (int x=seedX+direction; x >= wideX && x < wideRight; x+=direction) {
            if (border(x,y)) { last=x; missed=0; }
            else if (++missed >= 2) break; // tolerate 1px border gaps
        }
        return last;
    };
    auto locateVerticalSide = [&](int suggestedX,int bottomY,int& topY) {
        // A corner can be anti-aliased: permit up to 2px horizontal shift.
        for (int xx=suggestedX-2; xx<=suggestedX+2; ++xx) {
            int count=0;
            for (int h=3;h<=15;++h) if (border(xx,bottomY-h))++count;
            if (count < 9) continue;
            int top=bottomY-3;
            int consecutiveMisses=0;
            for (int y=bottomY-3; y>=std::max(wideY,bottomY-150);--y) {
                if (border(xx,y)) { top=y; consecutiveMisses=0; }
                else if (++consecutiveMisses >= 3) break;
            }
            if (bottomY-top>=22) { topY=top; return xx; }
        }
        return -1;
    };

    // Prefer seed nearest center; every candidate comes from [-13,+13].
    const int center=static_cast<int>(mouse.x);
    std::stable_sort(seeds.begin(),seeds.end(),[&](const POINT& a,const POINT& b){
        const int da=std::abs(static_cast<int>(a.x)-center) + 5*std::abs(static_cast<int>(a.y)-calibratedBottomY);
        const int db=std::abs(static_cast<int>(b.x)-center) + 5*std::abs(static_cast<int>(b.y)-calibratedBottomY);
        return da<db;
    });
    for (const POINT& seed : seeds) {
        if (!border(seed.x,seed.y)) continue;
        const int xLeft = horizontalEdge(seed.x,seed.y,-1);
        const int xRight = horizontalEdge(seed.x,seed.y,+1);
        const int w=xRight-xLeft;
        if (w<65 || w>700) continue;

        int leftTop=0,rightTop=0;
        const int l=locateVerticalSide(xLeft,seed.y,leftTop);
        const int r=locateVerticalSide(xRight,seed.y,rightTop);
        if (l<0 || r<0 || r<=l+60) continue;
        if (std::abs(leftTop-rightTop)>4) continue;
        const int top=(leftTop+rightTop)/2;

        // Confirm a REAL top horizontal edge, not just inventory lines.
        const int mid=(l+r)/2;
        bool validTop=false;
        for (int y=top-2;y<=top+2 && !validTop;++y) {
            int hits=0;
            for(int x : {l+8,mid,r-8}) if (border(x,y)) ++hits;
            validTop=(hits>=2);
        }
        if (!validTop) continue;
        result={l,top,r,static_cast<int>(seed.y)};
        return true;
    }
    return false;
}


// Cheap presence probe for an already-recognized tooltip. Unlike the full
// detector, this only captures the 27x5 calibrated bottom-border seed.
// Capture errors fail open so desktop read failures never dismiss a valid card.
static bool tooltipBottomBorderStillVisible(
    HDC dc, const POINT& mouse, int calibratedBottomY, const RECT& monitorRect)
{
    const int x0=std::max(static_cast<int>(monitorRect.left),
                          static_cast<int>(mouse.x)-13);
    const int x1=std::min(static_cast<int>(monitorRect.right)-1,
                          static_cast<int>(mouse.x)+13);
    const int y0=std::max(static_cast<int>(monitorRect.top),calibratedBottomY-2);
    const int y1=std::min(static_cast<int>(monitorRect.bottom)-1,calibratedBottomY+2);
    if (x1<x0 || y1<y0) return true; // no trustworthy sample
    if (!capturePixelRegion(dc,x0,y0,x1-x0+1,y1-y0+1,true)) return true;
    for (int y=y0;y<=y1;++y) {
        for (int x=x0;x<=x1;++x) {
            if (x<SHRT_MIN || x>SHRT_MAX || y<SHRT_MIN || y>SHRT_MAX)
                return true; // cannot sample safely
            short r=0,g=0,b=0;
            if (pixelIsValid(static_cast<short>(x),static_cast<short>(y),r,g,b))
                return true;
        }
    }
    return false;
}

static std::string scanForText(int x1, int y1, int width, int height) {
    if (!cachedDesktopDC || width < 1 || height < 1) return "";
    static unsigned long serial = 0;
    // Preserve the exact existing tooltip rectangle and desktop bitmap capture.
    Image img(cachedDesktopDC, x1, y1, width, height);
    std::error_code ec;
    auto cacheDir = std::filesystem::temp_directory_path(ec);
    if (ec) return "";
    cacheDir /= L"PriceChecker-OCR";
    cacheDir /= std::to_wstring(GetCurrentProcessId());
    std::filesystem::create_directories(cacheDir, ec);
    if (ec) return "";
    std::ostringstream filename;
    filename << "hover-" << ++serial << ".bmp";
    auto path = cacheDir / filename.str();
    BITMAPFILEHEADER header{};
    BITMAPINFOHEADER info{};
    info.biSize = sizeof(info);
    info.biWidth = img.GetWidth();
    info.biHeight = -img.GetHeight();
    info.biPlanes = 1;
    info.biBitCount = 32;
    info.biCompression = BI_RGB;
    const DWORD pixels = img.GetBytesPerScanLine() * img.GetHeight();
    header.bfType = 0x4D42;
    header.bfOffBits = sizeof(header) + sizeof(info);
    header.bfSize = header.bfOffBits + pixels;
    std::ofstream file(path, std::ios::binary);
    if (!file) return "";
    file.write(reinterpret_cast<const char*>(&header), sizeof(header));
    file.write(reinterpret_cast<const char*>(&info), sizeof(info));
    file.write(reinterpret_cast<const char*>(img.GetPixels()), pixels);
    file.close();
    if (!file) return "";
    return path.string();
}

static void rtrim(std::string& s) {
	// Define the characters to trim (common whitespaces)
	const std::string whitespaces = " \t\n\r\f\v";

	// Find the position of the last non-whitespace character
	size_t last_non_space = s.find_last_not_of(whitespaces);

	// If a non-whitespace character is found, resize the string to end just after it
	if (last_non_space != std::string::npos) {
		s.erase(last_non_space + 1);
	}
	else {
		// If the string contains only whitespace (or is empty), clear it
		s.clear();
	}
}

int main(int argc, char* argv[])
{
	// Set DPI awareness to ensure cursor coordinates match actual screen pixels
	SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);

	// Parse optional command line arguments for border color: red green blue
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

	short CURSOR_TOOLTIP_OFFSET_X{};
	short CURSOR_TOOLTIP_OFFSET_Y{};

	WCHAR exe_path[MAX_PATH];
	GetModuleFileNameW(NULL, exe_path, MAX_PATH);

	// 2. Extract the directory path
	std::wstring ws_exe_path(exe_path);
	std::wstring exe_dir = ws_exe_path.substr(0, ws_exe_path.find_last_of(L"\\/"));

	std::ifstream file(exe_dir + L"\\scanningConfig.json");

	// Check if the file opened successfully
	if (!file.is_open()) {
		cout << "IGNORE||NO CONFIG FILE FOUND" << endl;
		CURSOR_TOOLTIP_OFFSET_X = 13;
		CURSOR_TOOLTIP_OFFSET_Y = -13;
		//return 0;
	}
	else
	{
		cout << "IGNORE||CONFIG FILE FOUND" << endl;
		// Parse the JSON data directly from the input stream
		json data = json::parse(file);

		// Close the file (optional, as the ifstream destructor does this automatically)
		file.close();

		CURSOR_TOOLTIP_OFFSET_X = data["offsetX"];
		CURSOR_TOOLTIP_OFFSET_Y = data["offsetY"];
	}

	// Initialize cached desktop DC (optimization #2)
	cachedDesktopWindow = GetDesktopWindow();
	cachedDesktopDC = GetDC(cachedDesktopWindow);
	if (!cachedDesktopDC) {
		cerr << "Failed to get desktop DC" << endl;
		exit(1);
	}

    // PriceChecker v1: screen capture only. RapidOCR runs in a persistent
    // separate process and receives these exact BMPs through the Node bridge.
	// Track last scanned cursor position - only scan once per position
	static POINT lastScannedCursor = {0, 0};

	string scanText{};
	short checkRange = 50;
	short red = 0;
	short green = 0;
	short blue = 0;
	POINT mousePos{};
	POINT lastValidMousePos{};
	POINT bottomLeftBorderPoint{};
	LONG width = 0;
	LONG height = 0;
	POINT bottomRightBorderPoint{};
	POINT topLeftBorderPoint{};
	//bool mouseIsStationary = false;
	short mouseStationaryCount = 0;
	bool foundTooltip = false;
	bool showedMouseMoved = false;
    int absentBorderSamples = 0;
    auto nextBorderPresenceCheck = std::chrono::steady_clock::now();

	
	// Optimized polling loop (optimization #7)
	int sleepInterval = 25; // Default sleep interval
	
	while (true) {
		if (GetCursorPos(&mousePos)) {
			// Treat movements within ten pixels of the hover anchor as jitter.
            // Anchor is updated only on meaningful movement; small repeated
            // movements cannot indefinitely evade the threshold.
            const LONG dx = mousePos.x - lastValidMousePos.x;
            const LONG dy = mousePos.y - lastValidMousePos.y;
            if (dx * dx + dy * dy <= 100) {
				mouseStationaryCount++;
				sleepInterval = 25; // Normal interval when stationary
			}
			else
			{
				if (showedMouseMoved == false) {
					cout << "MOUSEMOVE" << endl;
					fflush(stdout);
					showedMouseMoved = true;
				}
                lastValidMousePos = mousePos;
				mouseStationaryCount = 0;
				foundTooltip = false;
                absentBorderSamples = 0;
                nextBorderPresenceCheck = std::chrono::steady_clock::now();
				sleepInterval = 50; // Longer interval when moving (optimization #7)
				cachedPixelBuffer.pixels.clear(); // Clear pixel cache
				lastScannedCursor = {0, 0}; // Reset last scanned cursor position
			}

			bottomLeftBorderPoint.x = mousePos.x + CURSOR_TOOLTIP_OFFSET_X;
			bottomLeftBorderPoint.y = mousePos.y + CURSOR_TOOLTIP_OFFSET_Y;

            // A Tarkov tooltip can disappear without any mouse movement
            // (inventory closes, focus changes, menu refresh). Previously
            // foundTooltip stayed true forever and no hide message was sent.
            // Only poll AFTER a valid OCR capture; 180ms between tiny probes
            // and require two misses to avoid transient frame flicker.
            if (foundTooltip &&
                mousePos.x == lastScannedCursor.x &&
                mousePos.y == lastScannedCursor.y &&
                std::chrono::steady_clock::now()>=nextBorderPresenceCheck) {
                nextBorderPresenceCheck=std::chrono::steady_clock::now()
                    +std::chrono::milliseconds(180);
                MONITORINFO info{};info.cbSize=sizeof(info);
                const HMONITOR mon=MonitorFromPoint(mousePos,MONITOR_DEFAULTTONEAREST);
                const bool monValid=GetMonitorInfo(mon,&info)!=FALSE;
                const RECT bounds=monValid ? info.rcMonitor :
                    RECT{GetSystemMetrics(SM_XVIRTUALSCREEN),
                         GetSystemMetrics(SM_YVIRTUALSCREEN),
                         GetSystemMetrics(SM_XVIRTUALSCREEN)+GetSystemMetrics(SM_CXVIRTUALSCREEN),
                         GetSystemMetrics(SM_YVIRTUALSCREEN)+GetSystemMetrics(SM_CYVIRTUALSCREEN)};
                const bool present=tooltipBottomBorderStillVisible(
                    cachedDesktopDC,mousePos,bottomLeftBorderPoint.y,bounds);
                absentBorderSamples=present ? 0 : absentBorderSamples+1;
                if (absentBorderSamples>=2) {
                    cout << "MOUSEMOVE" << endl; // existing protocol: hide popup
                    fflush(stdout);
                    showedMouseMoved=true;
                    foundTooltip=false;
                    lastScannedCursor={0,0}; // permit future hover at same position
                    absentBorderSamples=0;
                    cachedPixelBuffer.pixels.clear();
                }
            }

			// Check if we've already scanned this cursor position
			bool alreadyScanned = (mousePos.x == lastScannedCursor.x && mousePos.y == lastScannedCursor.y);
			
			// Only try to detect and scan tooltip if we haven't scanned this cursor position yet
			if (mouseStationaryCount > 2 && !foundTooltip && !alreadyScanned) {
                // A point on the bottom BORDER, not a fixed bottom-left
                // CORNER, is sufficient to locate the Tarkov tooltip.
                MONITORINFO monitorInfo{};
                monitorInfo.cbSize=sizeof(monitorInfo);
                const HMONITOR monitor=MonitorFromPoint(mousePos,MONITOR_DEFAULTTONEAREST);
                const bool monitorOk=GetMonitorInfo(monitor,&monitorInfo)!=FALSE;
                const RECT monitorRect=monitorOk ? monitorInfo.rcMonitor :
                    RECT{GetSystemMetrics(SM_XVIRTUALSCREEN),
                         GetSystemMetrics(SM_YVIRTUALSCREEN),
                         GetSystemMetrics(SM_XVIRTUALSCREEN)+GetSystemMetrics(SM_CXVIRTUALSCREEN),
                         GetSystemMetrics(SM_YVIRTUALSCREEN)+GetSystemMetrics(SM_CYVIRTUALSCREEN)};
                TooltipRect detected{};
                bool foundSeed=false;
                const bool foundRect=detectTooltipByBottomBorder(
                    cachedDesktopDC,mousePos,bottomLeftBorderPoint.y,
                    monitorRect,detected,foundSeed);

                // Diagnostic only, throttled: "no seed" distinguishes a
                // Y offset/color problem from rejected border geometry.
                static auto lastBorderMissLog=std::chrono::steady_clock::time_point{};
                const auto now=std::chrono::steady_clock::now();
                if (foundRect) {
                    std::cout<<"SCAN_BORDER||FOUND||"
                             <<detected.left<<","<<detected.top<<","
                             <<detected.right<<","<<detected.bottom
                             <<"||CURSOR||"<<mousePos.x<<","<<mousePos.y
                             <<std::endl;
                } else if (now-lastBorderMissLog>=std::chrono::seconds(5)) {
                    lastBorderMissLog=now;
                    std::cout<<"SCAN_BORDER||"<<(foundSeed ? "REJECTED" : "NO_SEED")
                             <<"||CURSOR||"<<mousePos.x<<","<<mousePos.y
                             <<"||EXPECTED_Y||"<<bottomLeftBorderPoint.y
                             <<std::endl;
                }

                if (foundRect) {
                    foundTooltip=true;
                    absentBorderSamples=0;
                    nextBorderPresenceCheck=std::chrono::steady_clock::now()
                        +std::chrono::milliseconds(180);
                    bottomLeftBorderPoint.x=detected.left;
                    bottomLeftBorderPoint.y=detected.bottom;
                    bottomRightBorderPoint.x=detected.right;
                    bottomRightBorderPoint.y=detected.bottom;
                    topLeftBorderPoint.x=detected.left;
                    topLeftBorderPoint.y=detected.top;
                    width=detected.right-detected.left;
                    height=detected.bottom-detected.top;
					if (width > 10 && height > 10) {
						// Perform OCR (only once per cursor position)
						scanText = scanForText( topLeftBorderPoint.x + 1, topLeftBorderPoint.y + 1, width, height);
						
						// Mark this cursor position as scanned
						if (scanText.length() > 3) {
							lastScannedCursor = mousePos;
							rtrim(scanText);
							cout << "CAPTURE||" << scanText << "||" << mousePos.x << "," << mousePos.y << endl;
							fflush(stdout);
							showedMouseMoved = false;
						}
					}
				}
			}

		}

		std::this_thread::sleep_for(std::chrono::milliseconds(sleepInterval));
	}


	ReleaseDC(cachedDesktopWindow, cachedDesktopDC);
	return 0;
}