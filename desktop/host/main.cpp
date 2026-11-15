#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <commdlg.h>
#include <shlobj.h>
#include <shellapi.h>
#include <objbase.h>

#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

#define IDI_APP_ICON 101

#define WM_APP_SAVE_DIALOG (WM_APP + 1)
#define WM_APP_EXIT_NOW (WM_APP + 2)
#define WM_APP_RELAUNCH_EXIT (WM_APP + 3)
#define WM_APP_CANCEL_CLOSE_TIMER (WM_APP + 4)
#define WM_APP_FALLBACK_CLOSE_PROMPT (WM_APP + 5)
#define IDT_CLOSE_ACK_TIMEOUT 1001

// ============================================================================
// Minimal Verified Microsoft WebView2 C-ABI Definitions (from WebView2.h)
// ============================================================================
struct WV2Controller;
struct WV2WebView;
struct WV2Environment;
struct WV2EnvHandler;
struct WV2CtrlHandler;

struct WV2EnvironmentVtbl {
  HRESULT (STDMETHODCALLTYPE *QueryInterface)(WV2Environment*, REFIID, void**);
  ULONG   (STDMETHODCALLTYPE *AddRef)(WV2Environment*);
  ULONG   (STDMETHODCALLTYPE *Release)(WV2Environment*);
  HRESULT (STDMETHODCALLTYPE *CreateCoreWebView2Controller)(WV2Environment*, HWND, WV2CtrlHandler*);
  void*   reserved[16];
};
struct WV2Environment { WV2EnvironmentVtbl* lpVtbl; };

struct WV2ControllerVtbl {
  HRESULT (STDMETHODCALLTYPE *QueryInterface)(WV2Controller*, REFIID, void**);
  ULONG   (STDMETHODCALLTYPE *AddRef)(WV2Controller*);
  ULONG   (STDMETHODCALLTYPE *Release)(WV2Controller*);
  HRESULT (STDMETHODCALLTYPE *get_IsVisible)(WV2Controller*, BOOL*);
  HRESULT (STDMETHODCALLTYPE *put_IsVisible)(WV2Controller*, BOOL);
  HRESULT (STDMETHODCALLTYPE *get_Bounds)(WV2Controller*, RECT*);
  HRESULT (STDMETHODCALLTYPE *put_Bounds)(WV2Controller*, RECT);
  HRESULT (STDMETHODCALLTYPE *get_ZoomFactor)(WV2Controller*, double*);
  HRESULT (STDMETHODCALLTYPE *put_ZoomFactor)(WV2Controller*, double);
  void*   add_ZoomFactorChanged;
  void*   remove_ZoomFactorChanged;
  void*   SetBoundsAndZoomFactor;
  void*   MoveFocus;
  void*   add_MoveFocusRequested;
  void*   remove_MoveFocusRequested;
  void*   add_GotFocus;
  void*   remove_GotFocus;
  void*   add_LostFocus;
  void*   remove_LostFocus;
  void*   add_AcceleratorKeyPressed;
  void*   remove_AcceleratorKeyPressed;
  HRESULT (STDMETHODCALLTYPE *get_ParentWindow)(WV2Controller*, HWND*);
  HRESULT (STDMETHODCALLTYPE *put_ParentWindow)(WV2Controller*, HWND);
  HRESULT (STDMETHODCALLTYPE *NotifyParentWindowPositionChanged)(WV2Controller*);
  HRESULT (STDMETHODCALLTYPE *Close)(WV2Controller*);
  HRESULT (STDMETHODCALLTYPE *get_CoreWebView2)(WV2Controller*, WV2WebView**);
};
struct WV2Controller { WV2ControllerVtbl* lpVtbl; };

struct WV2WebViewVtbl {
  HRESULT (STDMETHODCALLTYPE *QueryInterface)(WV2WebView*, REFIID, void**);
  ULONG   (STDMETHODCALLTYPE *AddRef)(WV2WebView*);
  ULONG   (STDMETHODCALLTYPE *Release)(WV2WebView*);
  void*   get_Settings;
  void*   get_Source;
  HRESULT (STDMETHODCALLTYPE *Navigate)(WV2WebView*, LPCWSTR);
  HRESULT (STDMETHODCALLTYPE *NavigateToString)(WV2WebView*, LPCWSTR);
  void*   reserved[32];
};
struct WV2WebView { WV2WebViewVtbl* lpVtbl; };

typedef HRESULT (STDAPICALLTYPE *PFN_CreateCoreWebView2EnvironmentWithOptions)(
    LPCWSTR browserExecutableFolder,
    LPCWSTR userDataFolder,
    void* environmentOptions,
    WV2EnvHandler* environmentCreatedHandler);

// ============================================================================
// Global Host State
// ============================================================================
static HWND g_hwnd = nullptr;
static WV2Controller* g_wvController = nullptr;
static WV2WebView* g_wvWebView = nullptr;
static std::atomic<bool> g_allowClose{false};
static std::atomic<bool> g_pendingClose{false};
static std::atomic<bool> g_serverRunning{true};
static std::atomic<bool> g_webviewReady{false};
static std::atomic<bool> g_uiConnected{false};
static std::atomic<bool> g_closeAcked{false};
static std::atomic<bool> g_fallbackLaunched{false};
static std::atomic<bool> g_browserWindowUnloaded{false};
static std::atomic<bool> g_fallbackPromptActive{false};
static int g_port = 0;
static std::wstring g_installDir;
static std::wstring g_exePath;
static CRITICAL_SECTION g_configCs;
static CRITICAL_SECTION g_sseCs;
static CRITICAL_SECTION g_stagedCs;
static std::string g_stagedSavePayload;
static std::vector<SOCKET> g_sseClients;

struct AutoCsLock {
  CRITICAL_SECTION* cs;
  explicit AutoCsLock(CRITICAL_SECTION* c) : cs(c) { EnterCriticalSection(cs); }
  ~AutoCsLock() { LeaveCriticalSection(cs); }
};

// ============================================================================
// UTF-8 / UTF-16 & Path Utilities
// ============================================================================
static std::wstring Utf8ToWide(const std::string& s) {
  if (s.empty()) return L"";
  int len = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
  if (len <= 0) return L"";
  std::wstring out(len, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), &out[0], len);
  return out;
}

static std::string WideToUtf8(const std::wstring& w) {
  if (w.empty()) return "";
  int len = WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), nullptr, 0, nullptr, nullptr);
  if (len <= 0) return "";
  std::string out(len, '\0');
  WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), &out[0], len, nullptr, nullptr);
  return out;
}

static bool FileExistsW(const std::wstring& path) {
  if (path.empty()) return false;
  DWORD attrs = GetFileAttributesW(path.c_str());
  return (attrs != INVALID_FILE_ATTRIBUTES) && !(attrs & FILE_ATTRIBUTE_DIRECTORY);
}

static bool DirExistsW(const std::wstring& path) {
  if (path.empty()) return false;
  DWORD attrs = GetFileAttributesW(path.c_str());
  return (attrs != INVALID_FILE_ATTRIBUTES) && (attrs & FILE_ATTRIBUTE_DIRECTORY);
}

static void EnsureDirRecursiveW(const std::wstring& dir) {
  if (dir.empty() || DirExistsW(dir)) return;
  size_t pos = dir.find_last_of(L"\\/");
  if (pos != std::wstring::npos && pos > 2) {
    EnsureDirRecursiveW(dir.substr(0, pos));
  }
  CreateDirectoryW(dir.c_str(), nullptr);
}

static std::wstring ParentDirW(const std::wstring& path) {
  size_t pos = path.find_last_of(L"\\/");
  if (pos == std::wstring::npos) return L"";
  return path.substr(0, pos);
}

static std::wstring BaseNameW(const std::wstring& path) {
  size_t pos = path.find_last_of(L"\\/");
  if (pos == std::wstring::npos) return path;
  return path.substr(pos + 1);
}

static bool ReadFileUtf8(const std::wstring& path, std::string& out) {
  HANDLE h = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
                         nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (h == INVALID_HANDLE_VALUE) return false;
  LARGE_INTEGER sz;
  if (!GetFileSizeEx(h, &sz) || sz.QuadPart > 64 * 1024 * 1024) {
    CloseHandle(h);
    return false;
  }
  out.resize((size_t)sz.QuadPart);
  DWORD totalRead = 0;
  while (totalRead < (DWORD)sz.QuadPart) {
    DWORD chunk = 0;
    if (!ReadFile(h, &out[totalRead], (DWORD)sz.QuadPart - totalRead, &chunk, nullptr) || chunk == 0) {
      CloseHandle(h);
      return false;
    }
    totalRead += chunk;
  }
  CloseHandle(h);
  return true;
}

static bool AtomicWriteFileUtf8(const std::wstring& path, const std::string& data) {
  std::wstring parent = ParentDirW(path);
  if (!parent.empty()) {
    EnsureDirRecursiveW(parent);
  }
  std::wstring tmpPath = path + L".tmp." + std::to_wstring(GetTickCount64());
  HANDLE h = CreateFileW(tmpPath.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS,
                         FILE_ATTRIBUTE_NORMAL, nullptr);
  if (h == INVALID_HANDLE_VALUE) return false;

  size_t written = 0;
  bool ok = true;
  while (written < data.size()) {
    DWORD chunk = 0;
    DWORD toWrite = (DWORD)std::min<size_t>(data.size() - written, 1024 * 1024);
    if (!WriteFile(h, data.data() + written, toWrite, &chunk, nullptr) || chunk == 0) {
      ok = false;
      break;
    }
    written += chunk;
  }
  if (ok) FlushFileBuffers(h);
  CloseHandle(h);

  if (!ok) {
    DeleteFileW(tmpPath.c_str());
    return false;
  }
  if (!MoveFileExW(tmpPath.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
    DeleteFileW(tmpPath.c_str());
    return false;
  }
  return true;
}

static std::wstring GetDocumentsDirW() {
  wchar_t buf[MAX_PATH] = {0};
  if (SUCCEEDED(SHGetFolderPathW(nullptr, CSIDL_PERSONAL, nullptr, SHGFP_TYPE_CURRENT, buf))) {
    if (DirExistsW(buf)) return std::wstring(buf);
  }
  wchar_t home[MAX_PATH] = {0};
  if (GetEnvironmentVariableW(L"USERPROFILE", home, MAX_PATH) > 0) {
    return std::wstring(home);
  }
  return g_installDir;
}

static std::wstring GetLocalAppDataConfigDirW() {
  wchar_t buf[MAX_PATH] = {0};
  if (SUCCEEDED(SHGetFolderPathW(nullptr, CSIDL_LOCAL_APPDATA, nullptr, SHGFP_TYPE_CURRENT, buf))) {
    return std::wstring(buf) + L"\\BowlingLeagueHelper";
  }
  return g_installDir;
}

static std::string CurrentIsoTimestamp() {
  SYSTEMTIME st;
  GetSystemTime(&st);
  char buf[64];
  std::snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02d.000Z",
                st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond);
  return std::string(buf);
}

static void AppendHostLog(const std::string& msg) {
  std::wstring dir = GetLocalAppDataConfigDirW();
  EnsureDirRecursiveW(dir);
  std::wstring logPath = dir + L"\\host.log";
  HANDLE h = CreateFileW(logPath.c_str(), FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE,
                         nullptr, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (h == INVALID_HANDLE_VALUE) return;
  LARGE_INTEGER sz = {};
  if (GetFileSizeEx(h, &sz) && sz.QuadPart > 65536) {
    CloseHandle(h);
    h = CreateFileW(logPath.c_str(), GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
                    nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (h == INVALID_HANDLE_VALUE) return;
  }
  std::string line = "[" + CurrentIsoTimestamp() + "] " + msg + "\r\n";
  DWORD written = 0;
  WriteFile(h, line.data(), (DWORD)line.size(), &written, nullptr);
  CloseHandle(h);
}

// ============================================================================
// Minimal Safe JSON Utilities (handles full HTML/JSON string payloads)
// ============================================================================
static std::string JsonEscape(const std::string& raw) {
  std::string out;
  out.reserve(raw.size() + 16);
  out.push_back('"');
  for (unsigned char c : raw) {
    switch (c) {
      case '"':  out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\b': out += "\\b"; break;
      case '\f': out += "\\f"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if (c < 0x20) {
          char hex[8];
          std::snprintf(hex, sizeof(hex), "\\u%04x", c);
          out += hex;
        } else {
          out.push_back((char)c);
        }
    }
  }
  out.push_back('"');
  return out;
}

static void AppendUtf8Codepoint(std::string& out, unsigned int cp) {
  if (cp <= 0x7F) {
    out.push_back((char)cp);
  } else if (cp <= 0x7FF) {
    out.push_back((char)(0xC0 | ((cp >> 6) & 0x1F)));
    out.push_back((char)(0x80 | (cp & 0x3F)));
  } else if (cp <= 0xFFFF) {
    out.push_back((char)(0xE0 | ((cp >> 12) & 0x0F)));
    out.push_back((char)(0x80 | ((cp >> 6) & 0x3F)));
    out.push_back((char)(0x80 | (cp & 0x3F)));
  } else {
    out.push_back((char)(0xF0 | ((cp >> 18) & 0x07)));
    out.push_back((char)(0x80 | ((cp >> 12) & 0x3F)));
    out.push_back((char)(0x80 | ((cp >> 6) & 0x3F)));
    out.push_back((char)(0x80 | (cp & 0x3F)));
  }
}

static bool ExtractJsonStringField(const std::string& json, const std::string& key, std::string& outVal) {
  std::string needle = "\"" + key + "\"";
  size_t i = 0;
  while (i < json.size()) {
    if (json[i] == '"') {
      // Check if this quoted string matches our key at current nesting depth
      if (json.compare(i, needle.size(), needle) == 0) {
        size_t after = i + needle.size();
        while (after < json.size() && (json[after] == ' ' || json[after] == '\t' || json[after] == '\r' || json[after] == '\n')) {
          after++;
        }
        if (after < json.size() && json[after] == ':') {
          after++;
          while (after < json.size() && (json[after] == ' ' || json[after] == '\t' || json[after] == '\r' || json[after] == '\n')) {
            after++;
          }
          if (after < json.size() && json[after] == '"') {
            after++;
            outVal.clear();
            while (after < json.size()) {
              char c = json[after++];
              if (c == '"') return true;
              if (c == '\\' && after < json.size()) {
                char esc = json[after++];
                switch (esc) {
                  case '"': outVal.push_back('"'); break;
                  case '\\': outVal.push_back('\\'); break;
                  case '/': outVal.push_back('/'); break;
                  case 'b': outVal.push_back('\b'); break;
                  case 'f': outVal.push_back('\f'); break;
                  case 'n': outVal.push_back('\n'); break;
                  case 'r': outVal.push_back('\r'); break;
                  case 't': outVal.push_back('\t'); break;
                  case 'u': {
                    if (after + 4 <= json.size()) {
                      unsigned int cp = 0;
                      for (int k = 0; k < 4; ++k) {
                        char h = json[after + k];
                        cp <<= 4;
                        if (h >= '0' && h <= '9') cp |= (h - '0');
                        else if (h >= 'a' && h <= 'f') cp |= (h - 'a' + 10);
                        else if (h >= 'A' && h <= 'F') cp |= (h - 'A' + 10);
                      }
                      after += 4;
                      AppendUtf8Codepoint(outVal, cp);
                    }
                    break;
                  }
                  default: outVal.push_back(esc); break;
                }
              } else {
                outVal.push_back(c);
              }
            }
            return false;
          }
        }
      }
      // Skip entire string literal cleanly so keys inside HTML payloads are never mismatched
      i++;
      while (i < json.size()) {
        if (json[i] == '\\') {
          i += 2;
        } else if (json[i] == '"') {
          i++;
          break;
        } else {
          i++;
        }
      }
      continue;
    }
    i++;
  }
  return false;
}

// ============================================================================
// Desktop Config & Version Helpers
// ============================================================================
struct DesktopConfig {
  std::string lastSaveFilePath;
  std::string lastSavedAt;
};

static DesktopConfig ReadDesktopConfig() {
  AutoCsLock lock(&g_configCs);
  DesktopConfig cfg;
  std::wstring primary = g_installDir + L"\\bowling-desktop-config.json";
  std::wstring secondary = GetLocalAppDataConfigDirW() + L"\\bowling-desktop-config.json";

  for (const auto& candidate : {primary, secondary}) {
    std::string raw;
    if (ReadFileUtf8(candidate, raw)) {
      ExtractJsonStringField(raw, "lastSaveFilePath", cfg.lastSaveFilePath);
      ExtractJsonStringField(raw, "lastSavedAt", cfg.lastSavedAt);
      if (!cfg.lastSaveFilePath.empty() || !cfg.lastSavedAt.empty()) {
        return cfg;
      }
    }
  }
  return cfg;
}

static void WriteDesktopConfig(const DesktopConfig& cfg) {
  AutoCsLock lock(&g_configCs);
  std::string json = "{\n"
    "  \"lastSaveFilePath\": " + JsonEscape(cfg.lastSaveFilePath) + ",\n"
    "  \"lastSavedAt\": " + (cfg.lastSavedAt.empty() ? std::string("null") : JsonEscape(cfg.lastSavedAt)) + ",\n"
    "  \"updatedAt\": " + JsonEscape(CurrentIsoTimestamp()) + "\n"
    "}\n";

  AtomicWriteFileUtf8(g_installDir + L"\\bowling-desktop-config.json", json);
  std::wstring localCfg = GetLocalAppDataConfigDirW() + L"\\bowling-desktop-config.json";
  AtomicWriteFileUtf8(localCfg, json);
}

static std::string ReadInstalledVersion() {
  std::string raw;
  if (ReadFileUtf8(g_installDir + L"\\version.json", raw)) {
    std::string ver;
    if (ExtractJsonStringField(raw, "latestVersion", ver) && !ver.empty()) {
      return ver;
    }
  }
  return "1.0.14";
}

// ============================================================================
// Native Save-As Dialog Dispatched on UI Thread
// ============================================================================
struct SaveDialogRequest {
  std::wstring title;
  std::wstring initialDir;
  std::wstring defaultName;
  bool accepted = false;
  std::wstring chosenPath;
};

static bool ShowSaveFileDialogOnUiThread(const std::wstring& title,
                                         const std::wstring& initialDir,
                                         const std::wstring& defaultName,
                                         std::wstring& outPath) {
  SaveDialogRequest req;
  req.title = title;
  req.initialDir = initialDir;
  req.defaultName = defaultName;
  if (g_hwnd && IsWindow(g_hwnd)) {
    SendMessageW(g_hwnd, WM_APP_SAVE_DIALOG, 0, (LPARAM)&req);
  } else {
    wchar_t fileBuf[2048] = {0};
    wcsncpy(fileBuf, defaultName.c_str(), 2047);
    OPENFILENAMEW ofn = {};
    ofn.lStructSize = sizeof(ofn);
    ofn.lpstrFilter = L"Bowling League Save File (*.json)\0*.json\0All Files (*.*)\0*.*\0";
    ofn.lpstrFile = fileBuf;
    ofn.nMaxFile = 2048;
    ofn.lpstrInitialDir = initialDir.empty() ? nullptr : initialDir.c_str();
    ofn.lpstrTitle = title.c_str();
    ofn.lpstrDefExt = L"json";
    ofn.Flags = OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR | OFN_EXPLORER;
    if (GetSaveFileNameW(&ofn)) {
      req.accepted = true;
      req.chosenPath = fileBuf;
    }
  }
  outPath = req.chosenPath;
  return req.accepted && !outPath.empty();
}

static void BroadcastCloseRequestEvent() {
  g_pendingClose.store(true);
  AutoCsLock lock(&g_sseCs);
  std::string msg = "event: request-close-save\ndata: {}\n\n";
  for (auto it = g_sseClients.begin(); it != g_sseClients.end();) {
    int sent = send(*it, msg.data(), (int)msg.size(), 0);
    if (sent <= 0) {
      int err = WSAGetLastError();
      if (sent == 0 || err != WSAEWOULDBLOCK) {
        closesocket(*it);
        it = g_sseClients.erase(it);
        continue;
      }
    }
    ++it;
  }
}

static bool ProbeAndPruneSseClients(bool sendPing) {
  AutoCsLock lock(&g_sseCs);
  for (auto it = g_sseClients.begin(); it != g_sseClients.end();) {
    char peekBuf[16];
    int r = recv(*it, peekBuf, sizeof(peekBuf), MSG_PEEK);
    if (r == 0) {
      closesocket(*it);
      it = g_sseClients.erase(it);
      continue;
    }
    if (r == SOCKET_ERROR) {
      int err = WSAGetLastError();
      if (err != WSAEWOULDBLOCK) {
        closesocket(*it);
        it = g_sseClients.erase(it);
        continue;
      }
    }
    if (sendPing) {
      const char* ping = ": ping\n\n";
      int sent = send(*it, ping, 8, 0);
      if (sent <= 0) {
        int err = WSAGetLastError();
        if (sent == 0 || err != WSAEWOULDBLOCK) {
          closesocket(*it);
          it = g_sseClients.erase(it);
          continue;
        }
      }
    }
    ++it;
  }
  return !g_sseClients.empty();
}

// ============================================================================
// Embedded Loopback HTTP Server (127.0.0.1:<port>)
// ============================================================================
static void SendHttpResponse(SOCKET s, int status, const char* statusText,
                             const char* contentType, const std::string& body) {
  char header[512];
  std::snprintf(header, sizeof(header),
                "HTTP/1.1 %d %s\r\n"
                "Content-Type: %s\r\n"
                "Content-Length: %zu\r\n"
                "Cache-Control: no-store, no-cache, must-revalidate\r\n"
                "Pragma: no-cache\r\n"
                "Connection: close\r\n\r\n",
                status, statusText, contentType, body.size());
  send(s, header, (int)std::strlen(header), 0);
  size_t sentTotal = 0;
  while (sentTotal < body.size()) {
    int chunk = send(s, body.data() + sentTotal,
                     (int)std::min<size_t>(body.size() - sentTotal, 65536), 0);
    if (chunk <= 0) break;
    sentTotal += (size_t)chunk;
  }
}

static void HandleHttpClient(SOCKET client) {
  DWORD timeoutMs = 15000;
  setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeoutMs, sizeof(timeoutMs));

  std::string buffer;
  buffer.reserve(8192);
  char temp[8192];
  size_t headerEnd = std::string::npos;

  while (true) {
    int n = recv(client, temp, sizeof(temp), 0);
    if (n <= 0) break;
    buffer.append(temp, n);
    headerEnd = buffer.find("\r\n\r\n");
    if (headerEnd != std::string::npos) break;
    if (buffer.size() > 65536) break;
  }

  if (headerEnd == std::string::npos) {
    closesocket(client);
    return;
  }

  std::string headers = buffer.substr(0, headerEnd);
  size_t sp1 = headers.find(' ');
  size_t sp2 = (sp1 != std::string::npos) ? headers.find(' ', sp1 + 1) : std::string::npos;
  if (sp1 == std::string::npos || sp2 == std::string::npos) {
    closesocket(client);
    return;
  }

  std::string method = headers.substr(0, sp1);
  std::string rawTarget = headers.substr(sp1 + 1, sp2 - sp1 - 1);
  std::string path = rawTarget;
  size_t qPos = path.find('?');
  if (qPos != std::string::npos) path = path.substr(0, qPos);

  size_t contentLength = 0;
  {
    std::string lowerHdr = headers;
    for (char& c : lowerHdr) c = (char)tolower((unsigned char)c);
    size_t clPos = lowerHdr.find("content-length:");
    if (clPos != std::string::npos) {
      contentLength = (size_t)std::strtoull(headers.c_str() + clPos + 15, nullptr, 10);
    }
  }

  if (contentLength > 32 * 1024 * 1024) {
    SendHttpResponse(client, 413, "Payload Too Large", "application/json", "{\"error\":\"Too large\"}");
    closesocket(client);
    return;
  }

  std::string body = buffer.substr(headerEnd + 4);
  while (body.size() < contentLength) {
    int n = recv(client, temp, sizeof(temp), 0);
    if (n <= 0) break;
    body.append(temp, n);
  }
  if (body.size() > contentLength && contentLength > 0) {
    body.resize(contentLength);
  }

  // ---- Route: SSE close interception stream ----
  if (method == "GET" && path == "/api/desktop/events") {
    g_uiConnected.store(true);
    g_browserWindowUnloaded.store(false);
    const char* sseHeader =
      "HTTP/1.1 200 OK\r\n"
      "Content-Type: text/event-stream\r\n"
      "Cache-Control: no-cache\r\n"
      "Connection: keep-alive\r\n\r\n"
      ": connected\n\n";
    send(client, sseHeader, (int)std::strlen(sseHeader), 0);
    u_long nonBlock = 1;
    ioctlsocket(client, FIONBIO, &nonBlock);
    {
      AutoCsLock lock(&g_sseCs);
      g_sseClients.push_back(client);
    }
    return;
  }

  // ---- Route: Acknowledge receipt of close-save request ----
  if (method == "POST" && path == "/api/desktop/close-ack") {
    g_closeAcked.store(true);
    if (g_hwnd) PostMessageW(g_hwnd, WM_APP_CANCEL_CLOSE_TIMER, 0, 0);
    SendHttpResponse(client, 200, "OK", "application/json", "{\"ok\":true}");
    closesocket(client);
    return;
  }

  // ---- Route: Stage latest state in memory (does not overwrite save file until close) ----
  if (method == "POST" && path == "/api/desktop/stage-state") {
    if (!body.empty()) {
      AutoCsLock lock(&g_stagedCs);
      g_stagedSavePayload = body;
    }
    SendHttpResponse(client, 200, "OK", "application/json", "{\"ok\":true}");
    closesocket(client);
    return;
  }

  // ---- Route: Background auto-save beacon when a browser window unloads ----
  if (method == "POST" && path == "/api/desktop/autosave-beacon") {
    DesktopConfig cfg = ReadDesktopConfig();
    bool saved = false;
    std::string payloadToWrite = body;
    if (payloadToWrite.find("\"useStaged\"") != std::string::npos) {
      AutoCsLock lock(&g_stagedCs);
      if (!g_stagedSavePayload.empty()) {
        payloadToWrite = g_stagedSavePayload;
      }
    } else if (!payloadToWrite.empty()) {
      AutoCsLock lock(&g_stagedCs);
      g_stagedSavePayload = payloadToWrite;
    }
    if (!cfg.lastSaveFilePath.empty() && !payloadToWrite.empty()) {
      std::wstring targetWide = Utf8ToWide(cfg.lastSaveFilePath);
      if (FileExistsW(targetWide) && AtomicWriteFileUtf8(targetWide, payloadToWrite)) {
        WriteDesktopConfig({cfg.lastSaveFilePath, CurrentIsoTimestamp()});
        saved = true;
      }
    }
    SendHttpResponse(client, 200, "OK", "application/json",
                     saved ? "{\"ok\":true}" : "{\"ok\":false}");
    closesocket(client);
    return;
  }

  // ---- Route: Notification that fallback browser window is unloading ----
  if (method == "POST" && path == "/api/desktop/window-unloaded") {
    if (!body.empty() && body.find("\"useStaged\"") == std::string::npos) {
      AutoCsLock lock(&g_stagedCs);
      g_stagedSavePayload = body;
    }
    g_browserWindowUnloaded.store(true);
    SendHttpResponse(client, 200, "OK", "application/json", "{\"ok\":true}");
    closesocket(client);
    return;
  }

  // ---- Route: Polling check for pending close ----
  if (method == "GET" && path == "/api/desktop/pending-close") {
    g_uiConnected.store(true);
    bool pending = g_pendingClose.exchange(false);
    SendHttpResponse(client, 200, "OK", "application/json",
                     pending ? "{\"pending\":true}" : "{\"pending\":false}");
    closesocket(client);
    return;
  }

  // ---- Route: Desktop Environment Info ----
  if (method == "GET" && path == "/api/desktop/info") {
    g_uiConnected.store(true);
    DesktopConfig cfg = ReadDesktopConfig();
    std::wstring lastWide = Utf8ToWide(cfg.lastSaveFilePath);
    bool exists = FileExistsW(lastWide);
    std::string json = "{\n"
      "  \"isDesktopApp\": true,\n"
      "  \"installDir\": " + JsonEscape(WideToUtf8(g_installDir)) + ",\n"
      "  \"defaultSaveDir\": " + JsonEscape(WideToUtf8(GetDocumentsDirW())) + ",\n"
      "  \"desktopVersion\": " + JsonEscape(ReadInstalledVersion()) + ",\n"
      "  \"lastSaveFilePath\": " + JsonEscape(cfg.lastSaveFilePath) + ",\n"
      "  \"lastSavedAt\": " + (cfg.lastSavedAt.empty() ? std::string("null") : JsonEscape(cfg.lastSavedAt)) + ",\n"
      "  \"lastSaveExists\": " + (exists ? "true" : "false") + "\n"
      "}";
    SendHttpResponse(client, 200, "OK", "application/json", json);
    closesocket(client);
    return;
  }

  // ---- Route: Load Linked Save File On Startup ----
  if (method == "GET" && path == "/api/desktop/load-save") {
    g_uiConnected.store(true);
    DesktopConfig cfg = ReadDesktopConfig();
    std::wstring targetWide = Utf8ToWide(cfg.lastSaveFilePath);
    if (cfg.lastSaveFilePath.empty() || !FileExistsW(targetWide)) {
      std::string resp = "{\"ok\":false,\"exists\":false,\"filePath\":" +
        JsonEscape(cfg.lastSaveFilePath) + "}";
      SendHttpResponse(client, 200, "OK", "application/json", resp);
      closesocket(client);
      return;
    }

    std::string jsonText;
    if (!ReadFileUtf8(targetWide, jsonText)) {
      std::string resp = "{\"ok\":false,\"exists\":false,\"filePath\":" +
        JsonEscape(cfg.lastSaveFilePath) +
        ",\"error\":\"Could not read linked save file.\"}";
      SendHttpResponse(client, 200, "OK", "application/json", resp);
      closesocket(client);
      return;
    }

    if (!jsonText.empty()) {
      AutoCsLock lock(&g_stagedCs);
      g_stagedSavePayload = jsonText;
    }
    std::string resp = "{\"ok\":true,\"exists\":true,\"filePath\":" +
      JsonEscape(cfg.lastSaveFilePath) + ",\"jsonText\":" + JsonEscape(jsonText) + "}";
    SendHttpResponse(client, 200, "OK", "application/json", resp);
    closesocket(client);
    return;
  }

  // ---- Route: Quick-Save Directly Over Linked Save File ----
  if (method == "POST" && path == "/api/desktop/quick-save") {
    std::string jsonText;
    ExtractJsonStringField(body, "jsonText", jsonText);
    if (jsonText.empty()) {
      AutoCsLock lock(&g_stagedCs);
      jsonText = g_stagedSavePayload;
    }

    DesktopConfig cfg = ReadDesktopConfig();
    std::wstring targetWide = Utf8ToWide(cfg.lastSaveFilePath);
    if (cfg.lastSaveFilePath.empty() || !FileExistsW(targetWide)) {
      SendHttpResponse(client, 200, "OK", "application/json",
                       "{\"saved\":false,\"missing\":true}");
      closesocket(client);
      return;
    }

    if (!AtomicWriteFileUtf8(targetWide, jsonText)) {
      SendHttpResponse(client, 200, "OK", "application/json",
                       "{\"saved\":false,\"missing\":false,\"error\":\"Could not write to linked save file.\"}");
      closesocket(client);
      return;
    }

    if (!jsonText.empty()) {
      AutoCsLock lock(&g_stagedCs);
      g_stagedSavePayload = jsonText;
    }
    std::string savedAt = CurrentIsoTimestamp();
    WriteDesktopConfig({cfg.lastSaveFilePath, savedAt});
    std::string fileUtf8 = WideToUtf8(BaseNameW(targetWide));
    std::string resp = "{\"saved\":true,\"missing\":false,\"filePath\":" +
      JsonEscape(cfg.lastSaveFilePath) + ",\"filename\":" + JsonEscape(fileUtf8) +
      ",\"savedAt\":" + JsonEscape(savedAt) + "}";
    SendHttpResponse(client, 200, "OK", "application/json", resp);
    closesocket(client);
    return;
  }

  // ---- Route: Unlink Last Save File On Start Fresh Reset ----
  if (method == "POST" && path == "/api/desktop/clear-save-link") {
    WriteDesktopConfig({"", ""});
    {
      AutoCsLock lock(&g_stagedCs);
      g_stagedSavePayload.clear();
    }
    SendHttpResponse(client, 200, "OK", "application/json", "{\"ok\":true}");
    closesocket(client);
    return;
  }

  // ---- Route: Save New League Data File ----
  if (method == "POST" && path == "/api/desktop/save-backup") {
    std::string jsonText;
    std::string defaultFilename = "BowlingLeagueTrackerSave.json";
    ExtractJsonStringField(body, "jsonText", jsonText);
    ExtractJsonStringField(body, "defaultFilename", defaultFilename);

    DesktopConfig cfg = ReadDesktopConfig();
    std::wstring startDir = GetDocumentsDirW();
    if (!cfg.lastSaveFilePath.empty()) {
      std::wstring prevParent = ParentDirW(Utf8ToWide(cfg.lastSaveFilePath));
      if (DirExistsW(prevParent)) startDir = prevParent;
    }

    std::wstring chosenPath;
    if (!ShowSaveFileDialogOnUiThread(L"Save Bowling League File", startDir,
                                      Utf8ToWide(defaultFilename), chosenPath)) {
      SendHttpResponse(client, 200, "OK", "application/json", "{\"saved\":false,\"canceled\":true}");
      closesocket(client);
      return;
    }

    if (!AtomicWriteFileUtf8(chosenPath, jsonText)) {
      SendHttpResponse(client, 200, "OK", "application/json",
                       "{\"saved\":false,\"error\":\"Could not write backup file to the selected folder.\"}");
      closesocket(client);
      return;
    }

    if (!jsonText.empty()) {
      AutoCsLock lock(&g_stagedCs);
      g_stagedSavePayload = jsonText;
    }
    std::string chosenUtf8 = WideToUtf8(chosenPath);
    std::string fileUtf8 = WideToUtf8(BaseNameW(chosenPath));
    std::string savedAt = CurrentIsoTimestamp();
    WriteDesktopConfig({chosenUtf8, savedAt});

    std::string resp = "{\"saved\":true,\"canceled\":false,\"filePath\":" + JsonEscape(chosenUtf8) +
      ",\"filename\":" + JsonEscape(fileUtf8) + ",\"savedAt\":" + JsonEscape(savedAt) + "}";
    SendHttpResponse(client, 200, "OK", "application/json", resp);
    closesocket(client);
    return;
  }

  // ---- Route: Auto-Save On Closing Verification ----
  if (method == "POST" && path == "/api/desktop/close-attempt") {
    std::string jsonText;
    ExtractJsonStringField(body, "jsonText", jsonText);
    if (jsonText.empty()) {
      AutoCsLock lock(&g_stagedCs);
      jsonText = g_stagedSavePayload;
    }

    DesktopConfig cfg = ReadDesktopConfig();
    std::wstring targetWide = Utf8ToWide(cfg.lastSaveFilePath);

    if (cfg.lastSaveFilePath.empty() || !FileExistsW(targetWide)) {
      g_pendingClose.store(false);
      std::string reason = cfg.lastSaveFilePath.empty()
        ? "No save file location has been selected yet."
        : ("Cannot find your last save file at \"" + cfg.lastSaveFilePath + "\".");
      std::string resp = "{\"ok\":false,\"missing\":true,\"missingPath\":" +
        (cfg.lastSaveFilePath.empty() ? std::string("null") : JsonEscape(cfg.lastSaveFilePath)) +
        ",\"reason\":" + JsonEscape(reason) + "}";
      SendHttpResponse(client, 200, "OK", "application/json", resp);
      closesocket(client);
      return;
    }

    if (!AtomicWriteFileUtf8(targetWide, jsonText)) {
      g_pendingClose.store(false);
      std::string resp = "{\"ok\":false,\"missing\":true,\"missingPath\":" +
        JsonEscape(cfg.lastSaveFilePath) +
        ",\"reason\":\"Could not write to last save file. Please pick a new location.\"}";
      SendHttpResponse(client, 200, "OK", "application/json", resp);
      closesocket(client);
      return;
    }

    WriteDesktopConfig({cfg.lastSaveFilePath, CurrentIsoTimestamp()});
    std::string resp = "{\"ok\":true,\"savedPath\":" + JsonEscape(cfg.lastSaveFilePath) + "}";
    SendHttpResponse(client, 200, "OK", "application/json", resp);
    closesocket(client);

    g_allowClose.store(true);
    g_pendingClose.store(false);
    if (g_hwnd) PostMessageW(g_hwnd, WM_APP_EXIT_NOW, 0, 0);
    return;
  }

  // ---- Route: Pick New Save Location & Finish Close ----
  if (method == "POST" && path == "/api/desktop/pick-save-and-close") {
    std::string jsonText;
    std::string defaultFilename = "BowlingLeagueTrackerSave.json";
    ExtractJsonStringField(body, "jsonText", jsonText);
    ExtractJsonStringField(body, "defaultFilename", defaultFilename);

    std::wstring chosenPath;
    if (!ShowSaveFileDialogOnUiThread(L"Pick Save File Location Before Closing",
                                      GetDocumentsDirW(),
                                      Utf8ToWide(defaultFilename), chosenPath)) {
      SendHttpResponse(client, 200, "OK", "application/json", "{\"closed\":false,\"canceled\":true}");
      closesocket(client);
      return;
    }

    if (!AtomicWriteFileUtf8(chosenPath, jsonText)) {
      SendHttpResponse(client, 200, "OK", "application/json",
                       "{\"closed\":false,\"error\":\"Could not save to chosen file location.\"}");
      closesocket(client);
      return;
    }

    std::string chosenUtf8 = WideToUtf8(chosenPath);
    WriteDesktopConfig({chosenUtf8, CurrentIsoTimestamp()});
    std::string resp = "{\"closed\":true,\"canceled\":false,\"filePath\":" + JsonEscape(chosenUtf8) + "}";
    SendHttpResponse(client, 200, "OK", "application/json", resp);
    closesocket(client);

    g_allowClose.store(true);
    g_pendingClose.store(false);
    if (g_hwnd) PostMessageW(g_hwnd, WM_APP_EXIT_NOW, 0, 0);
    return;
  }

  // ---- Route: Force Close Without Saving ("Don't Save") ----
  if (method == "POST" && path == "/api/desktop/force-close") {
    SendHttpResponse(client, 200, "OK", "application/json", "{\"closed\":true}");
    closesocket(client);
    g_allowClose.store(true);
    g_pendingClose.store(false);
    if (g_hwnd) PostMessageW(g_hwnd, WM_APP_EXIT_NOW, 0, 0);
    return;
  }

  // ---- Route: Cancel Pending Close ----
  if (method == "POST" && path == "/api/desktop/cancel-close") {
    g_pendingClose.store(false);
    SendHttpResponse(client, 200, "OK", "application/json", "{\"cancelled\":true}");
    closesocket(client);
    return;
  }

  // ---- Route: Install Update Into Program Folder & Relaunch ----
  if (method == "POST" && path == "/api/desktop/install-update") {
    std::string targetVersion;
    std::string htmlContent;
    std::string versionJsonContent;
    ExtractJsonStringField(body, "targetVersion", targetVersion);
    ExtractJsonStringField(body, "htmlContent", htmlContent);
    ExtractJsonStringField(body, "versionJsonContent", versionJsonContent);

    if (htmlContent.empty() || htmlContent.find("id=\"root\"") == std::string::npos) {
      SendHttpResponse(client, 200, "OK", "application/json",
                       "{\"ok\":false,\"error\":\"Downloaded update HTML bundle is invalid or incomplete.\"}");
      closesocket(client);
      return;
    }

    std::wstring htmlTarget = g_installDir + L"\\BowlingLeagueHelper.html";
    if (!AtomicWriteFileUtf8(htmlTarget, htmlContent)) {
      std::string errMsg = "Could not overwrite program files inside " + WideToUtf8(g_installDir) +
                           ". Check folder permissions and try again.";
      SendHttpResponse(client, 200, "OK", "application/json",
                       "{\"ok\":false,\"error\":" + JsonEscape(errMsg) + "}");
      closesocket(client);
      return;
    }

    if (!versionJsonContent.empty()) {
      AtomicWriteFileUtf8(g_installDir + L"\\version.json", versionJsonContent);
    }

    std::string resp = "{\"ok\":true,\"targetVersion\":" + JsonEscape(targetVersion) +
      ",\"installDir\":" + JsonEscape(WideToUtf8(g_installDir)) +
      ",\"updatedTargets\":[" + JsonEscape(WideToUtf8(htmlTarget)) + "]}";
    SendHttpResponse(client, 200, "OK", "application/json", resp);
    closesocket(client);

    g_allowClose.store(true);
    g_pendingClose.store(false);
    if (g_hwnd) PostMessageW(g_hwnd, WM_APP_RELAUNCH_EXIT, 0, 0);
    return;
  }

  // ---- Route: Static Assets From Program Folder ----
  if (method == "GET" && (path == "/" || path == "/index.html" || path == "/BowlingLeagueHelper.html")) {
    std::string html;
    if (!ReadFileUtf8(g_installDir + L"\\BowlingLeagueHelper.html", html)) {
      SendHttpResponse(client, 404, "Not Found", "text/plain; charset=utf-8",
                       "BowlingLeagueHelper.html was not found in the program folder.");
      closesocket(client);
      return;
    }
    // Inject native desktop host flag cleanly in-memory (does not modify file on disk)
    const char* marker = "<head>";
    size_t headPos = html.find(marker);
    std::string inject = "<script>window.__BOWLING_NATIVE_HOST__=true;</script>";
    if (headPos != std::string::npos) {
      html.insert(headPos + std::strlen(marker), inject);
    } else {
      html = inject + html;
    }
    SendHttpResponse(client, 200, "OK", "text/html; charset=utf-8", html);
    closesocket(client);
    return;
  }

  if (method == "GET" && path == "/version.json") {
    std::string json;
    if (ReadFileUtf8(g_installDir + L"\\version.json", json)) {
      SendHttpResponse(client, 200, "OK", "application/json", json);
    } else {
      SendHttpResponse(client, 404, "Not Found", "application/json", "{}");
    }
    closesocket(client);
    return;
  }

  if (method == "GET" && path == "/bowling-icon.png") {
    std::string png;
    if (ReadFileUtf8(g_installDir + L"\\bowling-icon.png", png)) {
      SendHttpResponse(client, 200, "OK", "image/png", png);
    } else {
      SendHttpResponse(client, 404, "Not Found", "text/plain", "");
    }
    closesocket(client);
    return;
  }

  SendHttpResponse(client, 404, "Not Found", "application/json", "{\"error\":\"Not found\"}");
  closesocket(client);
}

static DWORD WINAPI HttpClientWorkerProc(LPVOID param) {
  SOCKET client = (SOCKET)(ULONG_PTR)param;
  HandleHttpClient(client);
  return 0;
}

static DWORD WINAPI HttpServerThreadProc(LPVOID param) {
  SOCKET listenSock = (SOCKET)(ULONG_PTR)param;
  while (g_serverRunning.load()) {
    SOCKET client = accept(listenSock, nullptr, nullptr);
    if (client == INVALID_SOCKET) {
      if (!g_serverRunning.load()) break;
      Sleep(10);
      continue;
    }
    HANDLE hThread = CreateThread(nullptr, 0, HttpClientWorkerProc, (LPVOID)(ULONG_PTR)client, 0, nullptr);
    if (hThread) {
      CloseHandle(hThread);
    } else {
      closesocket(client);
    }
  }
  return 0;
}

// ============================================================================
// WebView2 Initialization & Automatic Fallback Window Controls
// ============================================================================
static std::string GetAppUrlUtf8() {
  return "http://127.0.0.1:" + std::to_string(g_port) + "/";
}

static DWORD WINAPI FallbackProcessWaitThread(LPVOID param) {
  HANDLE hProc = (HANDLE)param;
  if (hProc) {
    WaitForSingleObject(hProc, INFINITE);
    CloseHandle(hProc);
  }
  // If browser delegated to another process (e.g. Edge Startup Boost), wait up to 12s for UI connection
  for (int i = 0; i < 30 && g_serverRunning.load() && !g_uiConnected.load() &&
                  !g_browserWindowUnloaded.load() && !g_allowClose.load(); ++i) {
    Sleep(400);
  }

  unsigned int tick = 0;
  while (g_serverRunning.load() && !g_allowClose.load()) {
    Sleep(300);
    tick++;
    bool sendPing = (tick % 5 == 0) || g_browserWindowUnloaded.load();
    bool hasClients = ProbeAndPruneSseClients(sendPing);
    if (g_allowClose.load() || !g_serverRunning.load()) break;
    if (!hasClients) {
      // Brief grace period in case user hit F5 refresh and SSE is reconnecting
      Sleep(g_browserWindowUnloaded.load() ? 250 : 450);
      if (!ProbeAndPruneSseClients(true)) {
        break;
      }
    }
  }

  if (g_allowClose.load() || !g_serverRunning.load()) {
    if (g_hwnd && IsWindow(g_hwnd)) {
      PostMessageW(g_hwnd, WM_APP_EXIT_NOW, 0, 0);
    }
    return 0;
  }

  if (g_hwnd && IsWindow(g_hwnd)) {
    PostMessageW(g_hwnd, WM_APP_FALLBACK_CLOSE_PROMPT, 0, 0);
  }
  return 0;
}

static void LaunchBrowserFallbackWindow() {
  if (g_fallbackLaunched.exchange(true)) return;
  g_browserWindowUnloaded.store(false);
  // Hide the native host window immediately so the user NEVER sees two windows
  if (g_hwnd && IsWindow(g_hwnd)) {
    ShowWindow(g_hwnd, SW_HIDE);
  }

  std::wstring url = Utf8ToWide(GetAppUrlUtf8());
  std::wstring profileDir = GetLocalAppDataConfigDirW() + L"\\EdgeAppProfile";
  EnsureDirRecursiveW(profileDir);

  // Prefer Microsoft Edge in isolated --app window mode (single window, isolated cache)
  const wchar_t* edgeCandidates[] = {
    L"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    L"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  };
  for (const wchar_t* edgePath : edgeCandidates) {
    if (FileExistsW(edgePath)) {
      std::wstring args = L"\"" + std::wstring(edgePath) + L"\" --app=" + url +
                          L" --user-data-dir=\"" + profileDir + L"\" --new-window";
      STARTUPINFOW si = {};
      si.cb = sizeof(si);
      PROCESS_INFORMATION pi = {};
      std::vector<wchar_t> cmdBuf(args.begin(), args.end());
      cmdBuf.push_back(L'\0');
      if (CreateProcessW(edgePath, cmdBuf.data(), nullptr, nullptr, FALSE, 0, nullptr,
                         g_installDir.c_str(), &si, &pi)) {
        CloseHandle(pi.hThread);
        HANDLE hWait = CreateThread(nullptr, 0, FallbackProcessWaitThread, (LPVOID)pi.hProcess, 0, nullptr);
        if (!hWait) {
          CloseHandle(pi.hProcess);
        } else {
          CloseHandle(hWait);
        }
        return;
      }
    }
  }
  ShellExecuteW(nullptr, L"open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
  HANDLE hWait = CreateThread(nullptr, 0, FallbackProcessWaitThread, nullptr, 0, nullptr);
  if (hWait) CloseHandle(hWait);
}

// COM Callback implementations using exact IUnknown + Handler IID checks and Invoke vtables
static const GUID IID_WV2_IUnknown =
  {0x00000000, 0x0000, 0x0000, {0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46}};
static const GUID IID_WV2_EnvHandler =
  {0x4e8a3389, 0xc9d8, 0x4bd2, {0xb6, 0xb5, 0x12, 0x4f, 0xee, 0x6c, 0xc1, 0x4d}};
static const GUID IID_WV2_CtrlHandler =
  {0x6c4819f3, 0xc9b7, 0x4260, {0x81, 0x27, 0xc9, 0xf5, 0xbd, 0xe7, 0xf6, 0x8c}};

struct EnvCompletedCallback;
struct CtrlCompletedCallback;

static HRESULT STDMETHODCALLTYPE EnvCbQueryInterface(EnvCompletedCallback* This, REFIID riid, void** ppv) {
  if (!ppv) return E_POINTER;
  if (IsEqualGUID(riid, IID_WV2_IUnknown) || IsEqualGUID(riid, IID_WV2_EnvHandler)) {
    *ppv = This;
    return S_OK;
  }
  *ppv = nullptr;
  return E_NOINTERFACE;
}

static HRESULT STDMETHODCALLTYPE CtrlCbQueryInterface(CtrlCompletedCallback* This, REFIID riid, void** ppv) {
  if (!ppv) return E_POINTER;
  if (IsEqualGUID(riid, IID_WV2_IUnknown) || IsEqualGUID(riid, IID_WV2_CtrlHandler)) {
    *ppv = This;
    return S_OK;
  }
  *ppv = nullptr;
  return E_NOINTERFACE;
}

static ULONG STDMETHODCALLTYPE CbAddRef(void*) { return 1; }
static ULONG STDMETHODCALLTYPE CbRelease(void*) { return 1; }

struct CtrlCompletedCallbackVtbl {
  HRESULT (STDMETHODCALLTYPE *QueryInterface)(CtrlCompletedCallback*, REFIID, void**);
  ULONG   (STDMETHODCALLTYPE *AddRef)(CtrlCompletedCallback*);
  ULONG   (STDMETHODCALLTYPE *Release)(CtrlCompletedCallback*);
  HRESULT (STDMETHODCALLTYPE *Invoke)(CtrlCompletedCallback*, HRESULT, WV2Controller*);
};
struct CtrlCompletedCallback { CtrlCompletedCallbackVtbl* lpVtbl; };

static HRESULT STDMETHODCALLTYPE OnControllerCreated(CtrlCompletedCallback*, HRESULT res, WV2Controller* ctrl) {
  if (FAILED(res) || !ctrl) {
    char buf[128];
    std::snprintf(buf, sizeof(buf), "OnControllerCreated failed: hr=0x%08lx ctrl=%p", (unsigned long)res, (void*)ctrl);
    AppendHostLog(buf);
    LaunchBrowserFallbackWindow();
    return S_OK;
  }
  g_wvController = ctrl;
  g_wvController->lpVtbl->AddRef(g_wvController);

  RECT bounds = {};
  GetClientRect(g_hwnd, &bounds);
  g_wvController->lpVtbl->put_Bounds(g_wvController, bounds);
  g_wvController->lpVtbl->put_IsVisible(g_wvController, TRUE);

  if (SUCCEEDED(g_wvController->lpVtbl->get_CoreWebView2(g_wvController, &g_wvWebView)) && g_wvWebView) {
    g_webviewReady.store(true);
    std::wstring url = Utf8ToWide(GetAppUrlUtf8());
    g_wvWebView->lpVtbl->Navigate(g_wvWebView, url.c_str());
    InvalidateRect(g_hwnd, nullptr, TRUE);
  } else {
    AppendHostLog("get_CoreWebView2 failed or returned null");
    LaunchBrowserFallbackWindow();
  }
  return S_OK;
}

static CtrlCompletedCallbackVtbl g_ctrlCbVtbl = {
  CtrlCbQueryInterface,
  (ULONG (STDMETHODCALLTYPE*)(CtrlCompletedCallback*))CbAddRef,
  (ULONG (STDMETHODCALLTYPE*)(CtrlCompletedCallback*))CbRelease,
  OnControllerCreated
};
static CtrlCompletedCallback g_ctrlCb = { &g_ctrlCbVtbl };

struct EnvCompletedCallbackVtbl {
  HRESULT (STDMETHODCALLTYPE *QueryInterface)(EnvCompletedCallback*, REFIID, void**);
  ULONG   (STDMETHODCALLTYPE *AddRef)(EnvCompletedCallback*);
  ULONG   (STDMETHODCALLTYPE *Release)(EnvCompletedCallback*);
  HRESULT (STDMETHODCALLTYPE *Invoke)(EnvCompletedCallback*, HRESULT, WV2Environment*);
};
struct EnvCompletedCallback { EnvCompletedCallbackVtbl* lpVtbl; };

static HRESULT STDMETHODCALLTYPE OnEnvironmentCreated(EnvCompletedCallback*, HRESULT res, WV2Environment* env) {
  if (FAILED(res) || !env || !g_hwnd) {
    char buf[128];
    std::snprintf(buf, sizeof(buf), "OnEnvironmentCreated failed: hr=0x%08lx env=%p", (unsigned long)res, (void*)env);
    AppendHostLog(buf);
    LaunchBrowserFallbackWindow();
    return S_OK;
  }
  HRESULT hr = env->lpVtbl->CreateCoreWebView2Controller(env, g_hwnd, (WV2CtrlHandler*)&g_ctrlCb);
  if (FAILED(hr)) {
    char buf[128];
    std::snprintf(buf, sizeof(buf), "CreateCoreWebView2Controller failed: hr=0x%08lx", (unsigned long)hr);
    AppendHostLog(buf);
    LaunchBrowserFallbackWindow();
  }
  return S_OK;
}

static EnvCompletedCallbackVtbl g_envCbVtbl = {
  EnvCbQueryInterface,
  (ULONG (STDMETHODCALLTYPE*)(EnvCompletedCallback*))CbAddRef,
  (ULONG (STDMETHODCALLTYPE*)(EnvCompletedCallback*))CbRelease,
  OnEnvironmentCreated
};
static EnvCompletedCallback g_envCb = { &g_envCbVtbl };

static bool InitEmbeddedWebView2(HWND /*hwnd*/) {
  std::wstring loaderPath = g_installDir + L"\\WebView2Loader.dll";
  HMODULE hMod = FileExistsW(loaderPath) ? LoadLibraryW(loaderPath.c_str())
                                         : LoadLibraryW(L"WebView2Loader.dll");
  if (!hMod) {
    AppendHostLog("LoadLibraryW(WebView2Loader.dll) failed");
    return false;
  }

  PFN_CreateCoreWebView2EnvironmentWithOptions fnCreateEnv = nullptr;
  FARPROC rawProc = GetProcAddress(hMod, "CreateCoreWebView2EnvironmentWithOptions");
  if (rawProc) {
    std::memcpy(&fnCreateEnv, &rawProc, sizeof(fnCreateEnv));
  }
  if (!fnCreateEnv) {
    AppendHostLog("GetProcAddress(CreateCoreWebView2EnvironmentWithOptions) failed");
    return false;
  }

  std::wstring dataDir = GetLocalAppDataConfigDirW() + L"\\WebViewData";
  EnsureDirRecursiveW(dataDir);
  HRESULT hr = fnCreateEnv(nullptr, dataDir.c_str(), nullptr, (WV2EnvHandler*)&g_envCb);
  if (FAILED(hr)) {
    char buf[128];
    std::snprintf(buf, sizeof(buf), "CreateCoreWebView2EnvironmentWithOptions failed synchronously: hr=0x%08lx", (unsigned long)hr);
    AppendHostLog(buf);
    return false;
  }
  return true;
}

// ============================================================================
// Main Win32 Window Procedure (Handles [X] Save-on-Close Guard!)
// ============================================================================
static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  switch (msg) {
    case WM_CREATE: {
      if (!InitEmbeddedWebView2(hwnd)) {
        LaunchBrowserFallbackWindow();
      }
      return 0;
    }

    case WM_SIZE: {
      if (g_wvController) {
        RECT bounds = {};
        GetClientRect(hwnd, &bounds);
        g_wvController->lpVtbl->put_Bounds(g_wvController, bounds);
      }
      return 0;
    }

    case WM_PAINT: {
      PAINTSTRUCT ps;
      HDC hdc = BeginPaint(hwnd, &ps);
      if (!g_webviewReady.load()) {
        RECT r = {};
        GetClientRect(hwnd, &r);
        FillRect(hdc, &r, (HBRUSH)(COLOR_WINDOW + 1));
        SetBkMode(hdc, TRANSPARENT);
        std::wstring status = L"Loading Bowling League Helper...";
        RECT textRect = {32, 32, r.right - 32, r.bottom - 32};
        DrawTextW(hdc, status.c_str(), -1, &textRect, DT_LEFT | DT_SINGLELINE);
      }
      EndPaint(hwnd, &ps);
      return 0;
    }

    case WM_TIMER: {
      if (wParam == IDT_CLOSE_ACK_TIMEOUT) {
        KillTimer(hwnd, IDT_CLOSE_ACK_TIMEOUT);
        if (!g_closeAcked.load() && !g_allowClose.load()) {
          // Fallback if WebView2 UI didn't ack close prompt in time: auto-save or prompt natively
          DesktopConfig cfg = ReadDesktopConfig();
          std::string staged;
          {
            AutoCsLock lock(&g_stagedCs);
            staged = g_stagedSavePayload;
          }
          std::wstring targetWide = Utf8ToWide(cfg.lastSaveFilePath);
          if (!cfg.lastSaveFilePath.empty() && FileExistsW(targetWide) && !staged.empty() &&
              AtomicWriteFileUtf8(targetWide, staged)) {
            WriteDesktopConfig({cfg.lastSaveFilePath, CurrentIsoTimestamp()});
            g_allowClose.store(true);
            DestroyWindow(hwnd);
            return 0;
          }

          if (g_uiConnected.load() || g_webviewReady.load()) {
            int choice = MessageBoxW(
              hwnd,
              L"No save file location has been selected yet (or your last save file cannot be found).\n\n"
              L"Yes = Pick Save Location & Close\n"
              L"No = Don't Save (Close Anyway)\n"
              L"Cancel = Stay Open",
              L"Save Before Closing — Bowling League Helper",
              MB_YESNOCANCEL | MB_ICONWARNING | MB_DEFBUTTON1);
            if (choice == IDYES) {
              std::wstring chosenPath;
              if (ShowSaveFileDialogOnUiThread(L"Pick Save File Location Before Closing",
                                               GetDocumentsDirW(),
                                               L"BowlingLeagueTrackerSave.json", chosenPath)) {
                if (!staged.empty() && AtomicWriteFileUtf8(chosenPath, staged)) {
                  WriteDesktopConfig({WideToUtf8(chosenPath), CurrentIsoTimestamp()});
                  g_allowClose.store(true);
                  DestroyWindow(hwnd);
                }
              }
              g_pendingClose.store(false);
              return 0;
            } else if (choice == IDNO) {
              g_allowClose.store(true);
              DestroyWindow(hwnd);
              return 0;
            } else {
              g_pendingClose.store(false);
              return 0;
            }
          }

          g_allowClose.store(true);
          DestroyWindow(hwnd);
        }
      }
      return 0;
    }

    case WM_CLOSE: {
      if (!g_allowClose.load() && (g_webviewReady.load() || g_uiConnected.load())) {
        // Intercept native [X] close button: notify live UI to auto-save to last save file first
        g_closeAcked.store(false);
        BroadcastCloseRequestEvent();
        SetTimer(hwnd, IDT_CLOSE_ACK_TIMEOUT, 4000, nullptr);
        return 0;
      }
      DestroyWindow(hwnd);
      return 0;
    }

    case WM_APP_CANCEL_CLOSE_TIMER: {
      KillTimer(hwnd, IDT_CLOSE_ACK_TIMEOUT);
      return 0;
    }

    case WM_APP_SAVE_DIALOG: {
      auto* req = (SaveDialogRequest*)lParam;
      if (req) {
        wchar_t fileBuf[2048] = {0};
        wcsncpy(fileBuf, req->defaultName.c_str(), 2047);
        OPENFILENAMEW ofn = {};
        ofn.lStructSize = sizeof(ofn);
        ofn.hwndOwner = IsWindowVisible(hwnd) ? hwnd : nullptr;
        ofn.lpstrFilter = L"Bowling League Save File (*.json)\0*.json\0All Files (*.*)\0*.*\0";
        ofn.lpstrFile = fileBuf;
        ofn.nMaxFile = 2048;
        ofn.lpstrInitialDir = req->initialDir.empty() ? nullptr : req->initialDir.c_str();
        ofn.lpstrTitle = req->title.c_str();
        ofn.lpstrDefExt = L"json";
        ofn.Flags = OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR | OFN_EXPLORER;
        if (GetSaveFileNameW(&ofn)) {
          req->accepted = true;
          req->chosenPath = fileBuf;
        }
      }
      return 0;
    }

    case WM_APP_FALLBACK_CLOSE_PROMPT: {
      if (g_allowClose.load() || g_fallbackPromptActive.exchange(true)) {
        return 0;
      }

      DesktopConfig cfg = ReadDesktopConfig();
      std::string staged;
      {
        AutoCsLock lock(&g_stagedCs);
        staged = g_stagedSavePayload;
      }

      if (staged.empty()) {
        g_allowClose.store(true);
        g_fallbackPromptActive.store(false);
        DestroyWindow(hwnd);
        return 0;
      }

      std::wstring targetWide = Utf8ToWide(cfg.lastSaveFilePath);
      if (!cfg.lastSaveFilePath.empty() && FileExistsW(targetWide) &&
          AtomicWriteFileUtf8(targetWide, staged)) {
        WriteDesktopConfig({cfg.lastSaveFilePath, CurrentIsoTimestamp()});
        g_allowClose.store(true);
        g_fallbackPromptActive.store(false);
        DestroyWindow(hwnd);
        return 0;
      }

      std::wstring msgText = cfg.lastSaveFilePath.empty()
        ? L"No save file location has been selected yet.\n\n"
          L"Yes = Pick Save Location & Close\n"
          L"No = Don't Save (Close Without Saving)\n"
          L"Cancel = Reopen Bowling League Helper"
        : (L"Cannot find your last save file at:\n\"" + targetWide + L"\"\n\n"
           L"Yes = Pick Save Location & Close\n"
           L"No = Don't Save (Close Without Saving)\n"
           L"Cancel = Reopen Bowling League Helper");

      while (true) {
        int choice = MessageBoxW(
          nullptr,
          msgText.c_str(),
          L"Save Before Closing — Bowling League Helper",
          MB_YESNOCANCEL | MB_ICONWARNING | MB_DEFBUTTON1 | MB_SETFOREGROUND | MB_TOPMOST);

        if (choice == IDYES) {
          std::wstring startDir = GetDocumentsDirW();
          if (!cfg.lastSaveFilePath.empty()) {
            std::wstring prevParent = ParentDirW(targetWide);
            if (DirExistsW(prevParent)) startDir = prevParent;
          }
          std::wstring chosenPath;
          if (ShowSaveFileDialogOnUiThread(L"Pick Save File Location Before Closing",
                                           startDir,
                                           L"BowlingLeagueTrackerSave.json", chosenPath)) {
            if (AtomicWriteFileUtf8(chosenPath, staged)) {
              WriteDesktopConfig({WideToUtf8(chosenPath), CurrentIsoTimestamp()});
              g_allowClose.store(true);
              g_fallbackPromptActive.store(false);
              DestroyWindow(hwnd);
              return 0;
            }
            MessageBoxW(nullptr, L"Could not write save file to that folder. Try another folder.",
                        L"Save Failed — Bowling League Helper", MB_OK | MB_ICONERROR | MB_TOPMOST);
          }
          // If Save As was cancelled, loop back to the Yes/No/Cancel choice rather than losing data
          continue;
        } else if (choice == IDNO) {
          g_allowClose.store(true);
          g_fallbackPromptActive.store(false);
          DestroyWindow(hwnd);
          return 0;
        } else {
          // Cancel: reopen the app window with all local data intact
          g_fallbackPromptActive.store(false);
          g_browserWindowUnloaded.store(false);
          g_uiConnected.store(false);
          g_fallbackLaunched.store(false);
          LaunchBrowserFallbackWindow();
          return 0;
        }
      }
    }

    case WM_APP_EXIT_NOW: {
      g_allowClose.store(true);
      if (g_wvController) {
        g_wvController->lpVtbl->Close(g_wvController);
      }
      DestroyWindow(hwnd);
      return 0;
    }

    case WM_APP_RELAUNCH_EXIT: {
      g_allowClose.store(true);
      if (g_wvController) {
        g_wvController->lpVtbl->Close(g_wvController);
      }
      std::wstring args = L"\"" + g_exePath + L"\" --relaunch-wait=" + std::to_wstring(GetCurrentProcessId());
      STARTUPINFOW si = {};
      si.cb = sizeof(si);
      PROCESS_INFORMATION pi = {};
      std::vector<wchar_t> cmdBuf(args.begin(), args.end());
      cmdBuf.push_back(L'\0');
      if (CreateProcessW(g_exePath.c_str(), cmdBuf.data(), nullptr, nullptr, FALSE, 0,
                         nullptr, g_installDir.c_str(), &si, &pi)) {
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
      }
      DestroyWindow(hwnd);
      return 0;
    }

    case WM_DESTROY: {
      g_serverRunning.store(false);
      PostQuitMessage(0);
      return 0;
    }
  }
  return DefWindowProcW(hwnd, msg, wParam, lParam);
}

int WINAPI wWinMain(HINSTANCE hInst, HINSTANCE, PWSTR cmdLine, int nCmdShow) {
  // Support clean zero-console relaunch after self-update
  if (cmdLine && wcsstr(cmdLine, L"--relaunch-wait=")) {
    const wchar_t* p = wcsstr(cmdLine, L"--relaunch-wait=") + 16;
    DWORD oldPid = (DWORD)_wtoi(p);
    if (oldPid != 0) {
      HANDLE hOld = OpenProcess(SYNCHRONIZE, FALSE, oldPid);
      if (hOld) {
        WaitForSingleObject(hOld, 5000);
        CloseHandle(hOld);
      }
    }
  }

  InitializeCriticalSection(&g_configCs);
  InitializeCriticalSection(&g_sseCs);
  InitializeCriticalSection(&g_stagedCs);
  CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

  wchar_t exeBuf[MAX_PATH] = {0};
  GetModuleFileNameW(nullptr, exeBuf, MAX_PATH);
  g_exePath = exeBuf;
  g_installDir = ParentDirW(g_exePath);

  WSADATA wsa;
  if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
    MessageBoxW(nullptr, L"Could not initialize local desktop networking.", L"Bowling League Helper", MB_ICONERROR);
    return 1;
  }

  SOCKET listenSock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  if (listenSock == INVALID_SOCKET) {
    WSACleanup();
    return 1;
  }

  sockaddr_in addr = {};
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  addr.sin_port = 0; // Ephemeral free localhost port

  if (bind(listenSock, (sockaddr*)&addr, sizeof(addr)) == SOCKET_ERROR ||
      listen(listenSock, SOMAXCONN) == SOCKET_ERROR) {
    closesocket(listenSock);
    WSACleanup();
    return 1;
  }

  int addrLen = sizeof(addr);
  getsockname(listenSock, (sockaddr*)&addr, &addrLen);
  g_port = ntohs(addr.sin_port);

  HANDLE hServerThread = CreateThread(nullptr, 0, HttpServerThreadProc, (LPVOID)(ULONG_PTR)listenSock, 0, nullptr);
  if (hServerThread) CloseHandle(hServerThread);

  HICON hIcon = (HICON)LoadImageW(hInst, MAKEINTRESOURCEW(IDI_APP_ICON), IMAGE_ICON, 0, 0, LR_DEFAULTSIZE);

  WNDCLASSEXW wc = {};
  wc.cbSize = sizeof(wc);
  wc.lpfnWndProc = WndProc;
  wc.hInstance = hInst;
  wc.hIcon = hIcon;
  wc.hIconSm = hIcon;
  wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  wc.lpszClassName = L"BowlingLeagueHelperWndClass";
  RegisterClassExW(&wc);

  int screenW = GetSystemMetrics(SM_CXSCREEN);
  int screenH = GetSystemMetrics(SM_CYSCREEN);
  int winW = std::min(1440, std::max(1024, screenW - 80));
  int winH = std::min(900, std::max(700, screenH - 80));
  int posX = std::max(0, (screenW - winW) / 2);
  int posY = std::max(0, (screenH - winH) / 2);

  g_hwnd = CreateWindowExW(
      0,
      wc.lpszClassName,
      L"Bowling League Helper",
      WS_OVERLAPPEDWINDOW,
      posX, posY, winW, winH,
      nullptr, nullptr, hInst, nullptr);

  if (!g_hwnd) {
    closesocket(listenSock);
    WSACleanup();
    return 1;
  }

  if (!g_fallbackLaunched.load()) {
    ShowWindow(g_hwnd, nCmdShow ? nCmdShow : SW_SHOWNORMAL);
    UpdateWindow(g_hwnd);
  }

  MSG msg;
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }

  g_serverRunning.store(false);
  closesocket(listenSock);
  {
    AutoCsLock lock(&g_sseCs);
    for (SOCKET s : g_sseClients) closesocket(s);
    g_sseClients.clear();
  }
  WSACleanup();
  CoUninitialize();
  DeleteCriticalSection(&g_stagedCs);
  DeleteCriticalSection(&g_sseCs);
  DeleteCriticalSection(&g_configCs);
  return (int)msg.wParam;
}
