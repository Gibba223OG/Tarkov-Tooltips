import QtQuick
import QtQuick.Window

// Standalone Qt Quick window: no WebView2, CSS, Electron or Tauri rendering.
Window {
    id: popup
    title: "Tarkov Tooltips (Qt prototype)"
    visible: false
    color: settings.popupBackground || "#080909"
    flags: Qt.ToolTip | Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint
           | Qt.WindowTransparentForInput | Qt.WindowDoesNotAcceptFocus

    property var payload: ({})
    property var settings: ({})
    readonly property bool ammo: !!(payload && payload.ammoStats && payload.ammoStats.ratings)
    readonly property real displayScale: ammo
        ? Math.max(0.25, Math.min(1, Number(settings.popupAmmoScale || 45) / 100))
        : Math.max(0.5, Math.min(2, Number(settings.popupMainScale || 55) / 50))

    // Keep the ammo card a physical pixel clear of each native window edge.
    // The unscaled overlay border stays 1 logical pixel wide at every ammo scale.
    readonly property int ammoEdgeInset: ammo ? 1 : 0
    width: Math.max(1, Math.ceil((content.item ? content.item.implicitWidth : 1) * displayScale)) + ammoEdgeInset * 2
    height: Math.max(1, Math.ceil((content.item ? content.item.implicitHeight : 1) * displayScale)) + ammoEdgeInset * 2

    Loader {
        id: content
        x: popup.ammoEdgeInset; y: popup.ammoEdgeInset
        transformOrigin: Item.TopLeft
        scale: popup.displayScale
        sourceComponent: popup.ammo ? ammoCard : priceCard
    }
    // Draw one full-resolution border at the actual native window edge for
    // BOTH popups. The price layer is scaled and may leave a one-pixel
    // background strip at right/bottom after ceil() rounds the window size.
    Rectangle {
        visible: true
        x: 0
        y: 0
        width: popup.width
        height: popup.height
        color: "transparent"
        border.width: 1
        border.color: popup.settings.popupBorder || "#59605a"
        radius: 0
        z: 2
    }
    Component {
        id: priceCard
        PriceCard { record: popup.payload; options: popup.settings }
    }
    Component {
        id: ammoCard
        AmmoCard { record: popup.payload; options: popup.settings }
    }
}
