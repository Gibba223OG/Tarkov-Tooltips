#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::io::{self, BufRead, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{Emitter, Manager, LogicalSize, PhysicalPosition, PhysicalSize, Position, Size};
use serde_json::Value;

struct Sequence(Arc<AtomicU64>);

#[tauri::command]
fn frontend_ready() {
    println!("READY");
    let _ = io::stdout().flush();
}

#[tauri::command]
fn prepare_popup(app: tauri::AppHandle, width: f64, height: f64, pixel_ratio: f64, seq: u64) -> Result<(), String> {
    let current = app.state::<Sequence>();
    if current.0.load(Ordering::SeqCst) != seq { return Ok(()); }
    if !width.is_finite() || !height.is_finite() || width < 1.0 || height < 1.0
       || !pixel_ratio.is_finite() || pixel_ratio < 0.5 || pixel_ratio > 5.0
       || width > 2500.0 || height > 2000.0 { return Err("Invalid preparation geometry".into()); }
    let win=app.get_webview_window("popup").ok_or("popup window absent")?;
    // Allow WebView2 to reflow at the card's eventual width while still hidden.
    win.set_size(Size::Physical(PhysicalSize::new((width.ceil()*pixel_ratio).ceil() as u32,(height.ceil()*pixel_ratio).ceil() as u32)))
      .map_err(|e|e.to_string())
}

#[tauri::command]
fn show_popup(app: tauri::AppHandle, width: f64, height: f64,
              cursor_x: f64, cursor_y: f64, pixel_ratio: f64, seq: u64, diagnostics: Option<serde_json::Value>) -> Result<(), String> {
    let current = app.state::<Sequence>();
    if current.0.load(Ordering::SeqCst) != seq { return Ok(()); }
    if !width.is_finite() || !height.is_finite() ||
       !cursor_x.is_finite() || !cursor_y.is_finite() ||
       !pixel_ratio.is_finite() || pixel_ratio < 0.5 || pixel_ratio > 5.0 ||
       width < 1.0 || height < 1.0 || width > 2500.0 || height > 2000.0 {
       return Err("Invalid card geometry".into());
    }
    let win = app.get_webview_window("popup").ok_or("popup window absent")?;
    if let Some(info)=diagnostics { eprintln!("POPUP_MEASUREMENTS {}",info); }
    // The electron host passes physical Windows GetCursorPos coordinates.
    // Tauri's own cursor_position is also physical and avoids stale hover
    // coordinates. The captured coordinates remain a safe fallback.
    let mut cursor = win.cursor_position()
      .unwrap_or(PhysicalPosition::new(cursor_x, cursor_y));
    if !cursor.x.is_finite() || !cursor.y.is_finite() {
      cursor = PhysicalPosition::new(cursor_x, cursor_y);
    }

    // Choose the monitor containing the mouse, NOT the monitor containing
    // the popup's last position. Monitor rectangles are physical pixels.
    let monitors = win.available_monitors().map_err(|e|e.to_string())?;
    let selected_monitor = monitors.iter().find(|m| {
      let p=m.position(); let s=m.size();
      cursor.x >= p.x as f64 && cursor.y >= p.y as f64 &&
      cursor.x < p.x as f64+s.width as f64 &&
      cursor.y < p.y as f64+s.height as f64
    });
    let scale=selected_monitor.map(|m|m.scale_factor()).unwrap_or(1.0).max(0.5);
    // CSS is in logical pixels, Win32 positions are physical pixels.
    // No arbitrary 80x70 minimum. 2px viewport safety comes from JS.
    // Confirmed correction: trim ONE physical pixel at the right edge only.
    // The previous +2 CSS-pixel gutter is already removed from HTML.
    // Height, popup CSS, window flags and all other calculations are unchanged.
    let physical_width=((width.ceil()*pixel_ratio).ceil() as u32).saturating_sub(1);
    let physical_height=(height.ceil()*pixel_ratio).ceil() as u32;
    win.set_size(Size::Physical(PhysicalSize::new(physical_width,physical_height)))
      .map_err(|e|e.to_string())?;
    let client=win.inner_size().map_err(|e|e.to_string())?;
    let outer=win.outer_size().map_err(|e|e.to_string())?;
    eprintln!("TAURI_CLIENT_SIZE requested={}x{} client={}x{} outer={}x{} scale={}",
       physical_width, physical_height, client.width, client.height,
       outer.width, outer.height, pixel_ratio);
    // This is a native client-size correction, not a CSS minimum size.
    // Some frameless Windows configurations report a smaller drawable
    // client area even though the HWND exterior has been resized.
    if client.width < physical_width || client.height < physical_height {
       let corrected_width=physical_width.saturating_add(physical_width-client.width);
       let corrected_height=physical_height.saturating_add(physical_height-client.height);
       win.set_size(Size::Physical(PhysicalSize::new(corrected_width,corrected_height)))
         .map_err(|e|e.to_string())?;
       let after=win.inner_size().map_err(|e|e.to_string())?;
       eprintln!("TAURI_CLIENT_CORRECTED {}x{}",after.width,after.height);
    }

    let offset=(13.0*scale).round();
    let (mut x,mut y)=(cursor.x+offset,cursor.y+offset);
    if let Some(m)=selected_monitor {
      let area=m.work_area();
      let left=area.position.x as f64;
      let top=area.position.y as f64;
      let right=left+area.size.width as f64;
      let bottom=top+area.size.height as f64;
      if x+physical_width as f64>right {
        x=cursor.x-physical_width as f64-offset;
      }
      if y+physical_height as f64>bottom {
        y=cursor.y-physical_height as f64-offset;
      }
      x=x.max(left).min((right-physical_width as f64).max(left));
      y=y.max(top).min((bottom-physical_height as f64).max(top));
    }
    win.set_position(Position::Physical(PhysicalPosition::new(x.round() as i32,y.round() as i32)))
      .map_err(|e|e.to_string())?;
    // Ignore mouse and keyboard focus, so the underlying game stays interactive.
    if current.0.load(Ordering::SeqCst) != seq { return Ok(()); }
    win.show().map_err(|e|e.to_string())?;
    // Reassert no native shadow AFTER show, not only at creation/config.
    // Native Tauri/Windows rendering settings may change during resize/show.
    win.set_shadow(false).map_err(|e|e.to_string())?;
    #[cfg(windows)]
    {
       // The native Win11 corner preference can reset on show/resize.
       use windows_sys::Win32::Graphics::Dwm::{
         DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE,DWMWA_BORDER_COLOR
       };
       let pref: u32=1; // Never round the square price card
       let border_none: u32=0xFFFFFFFE; // DWMWA_COLOR_NONE, suppress native DWM frame border
       if let Ok(hwnd)=win.hwnd() {
         let hr=unsafe {DwmSetWindowAttribute(hwnd.0 as _,DWMWA_WINDOW_CORNER_PREFERENCE as u32,
           &pref as *const u32 as *const _,4)};
         if hr!=0 {eprintln!("DWM_CORNER_AFTER_SHOW_FAILED {}",hr);}
         let border_hr=unsafe {DwmSetWindowAttribute(hwnd.0 as _,DWMWA_BORDER_COLOR as u32,
           &border_none as *const u32 as *const _,4)};
         if border_hr!=0 {eprintln!("DWM_BORDER_DISABLE_FAILED {}",border_hr);}
         else {eprintln!("DWM_NATIVE_BORDER_DISABLED");}
       }
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
      .manage(Sequence(Arc::new(AtomicU64::new(0))))
      .invoke_handler(tauri::generate_handler![frontend_ready, prepare_popup, show_popup])
      .setup(|app| {
        let window=app.get_webview_window("popup").expect("popup window");
        window.set_ignore_cursor_events(true)?;
        window.set_focusable(false)?;
        window.set_always_on_top(true)?;
        // Tauri's shadow:false window config is retained. Also apply at
        // runtime to the undecorated HWND before the first show.
        window.set_shadow(false)?;
        // Windows 11 can round undecorated native corners even though
        // the HTML price card uses CSS rounded-none.
        // Explicitly request square HWND corners. This is separate from CSS.
        #[cfg(windows)]
        {
          use windows_sys::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE
          };
          let preference: u32 = 1; // DWMWCP_DONOTROUND
          if let Ok(hwnd)=window.hwnd() {
            let result=unsafe {
              DwmSetWindowAttribute(
                hwnd.0 as _,
                DWMWA_WINDOW_CORNER_PREFERENCE as u32,
                &preference as *const u32 as *const _,
                std::mem::size_of::<u32>() as u32
              )
            };
            if result!=0 { eprintln!("DWM_CORNER_PREFERENCE_FAILED {result}"); }
            // Windows 11 draws its own non-client border independently from
            // CSS; this disables that NATIVE border only, not the React border.
            use windows_sys::Win32::Graphics::Dwm::DWMWA_BORDER_COLOR;
            let no_border: u32=0xFFFFFFFE;
            let hr=unsafe{DwmSetWindowAttribute(hwnd.0 as _,
                 DWMWA_BORDER_COLOR as u32,
                 &no_border as *const u32 as *const _,
                 std::mem::size_of::<u32>() as u32)};
            if hr!=0 {eprintln!("DWM_BORDER_INIT_FAILED {hr}");}
          }
        }
        let handle=app.handle().clone();
        std::thread::spawn(move || {
          for line in io::stdin().lock().lines() {
            let line=match line {Ok(v)=>v,Err(_)=>break};
            let data:Value=match serde_json::from_str(&line) {
              Ok(v)=>v, Err(e)=>{eprintln!("Host JSON parse: {e}");continue;}
            };
            let kind=data.get("type").and_then(Value::as_str).unwrap_or("");
            let seq=data.get("seq").and_then(Value::as_u64);
            if let Some(seq)=seq {
              handle.state::<Sequence>().0.store(seq, Ordering::SeqCst);
            }
            if kind=="hide" {
              if let Some(win)=handle.get_webview_window("popup"){let _=win.hide();}
            } else if kind=="item" || kind=="config" {
              if let Some(win)=handle.get_webview_window("popup") {
                if let Some(top)=data.get("config").and_then(|c|c.get("enableAlwaysOnTop")).and_then(Value::as_bool) { let _=win.set_always_on_top(top); }
                if kind=="item" { let _=win.hide(); let _=win.set_size(Size::Logical(LogicalSize::new(850.0,700.0))); }
              }
              let _=handle.emit_to("popup","host-message",&data);
            }
          }
          handle.exit(0);
        });
        Ok(())
      })
      .run(tauri::generate_context!())
      .expect("Tauri popup failed");
}
