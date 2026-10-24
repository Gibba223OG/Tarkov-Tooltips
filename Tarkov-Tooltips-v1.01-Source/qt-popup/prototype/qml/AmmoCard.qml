import QtQuick

Rectangle {
    id: card
    property var record: ({})
    property var options: ({})
    readonly property var stats: record.ammoStats || ({})
    // Wiki displays pellet rounds as count x damage per projectile.
    // The user requested damage and penetration only for multi-projectile rounds.
    readonly property bool multiProjectile: /^[0-9]+[x×][0-9]+$/.test(String(stats.damage || ""))
    readonly property color textColor: "#e4e1d6"
    color: options.popupBackground || "#080909"
    border.color: options.popupBorder || "#59605a"
    // Border is drawn once, unscaled, by Popup.qml at the native window edge.
    border.width: 0
    radius: 0
    implicitWidth: 588   // 530px chart + 14px left + 44px right (2x previous 22px)
    implicitHeight: Math.ceil(body.implicitHeight + 28)

    Column {
        id: body
        x: 14; y: 13
        spacing: 0
        Text {
            text: String(card.record.name || "")
            color: card.textColor
            font.family: "Bender"
            font.weight: Font.Light
            font.pixelSize: 37
            width: 530
            wrapMode: Text.WrapAnywhere
        }
        Text {
            visible: card.options.showOcrDiagnostics === true
            text: "OCR: " + String(card.record.ocrText || "(empty)") +
                  (typeof card.record.ocrMs === "number" ? " (" + card.record.ocrMs + " ms)" : "")
            color: "#adcdbd"
            font.family: "Bender"
            font.pixelSize: 26
            width: 530
            wrapMode: Text.WrapAnywhere
            height: visible ? implicitHeight : 0
        }
        Item { width: 1; height: 15 }
        Row {
            spacing: 42
            Row {
                spacing: 9
                Text {
                    text: "DMG"
                    color: card.textColor
                    font.family: "Bender"
                    font.weight: Font.Light
                    font.pixelSize: 26
                }
                Text {
                    text: String(card.stats.damage ?? "").replace("x", "×")
                    color: "#e8ebdf"
                    font.family: "Bender"
                    font.weight: Font.Bold
                    font.pixelSize: 36
                }
            }
            Row {
                spacing: 9
                Text {
                    text: "PEN"
                    color: card.textColor
                    font.family: "Bender"
                    font.weight: Font.Light
                    font.pixelSize: 26
                }
                Text {
                    text: String(card.stats.penetration ?? "")
                    color: "#e8ebdf"
                    font.family: "Bender"
                    font.weight: Font.Bold
                    font.pixelSize: 36
                }
            }
        }
        Item { width: 1; height: card.multiProjectile ? 0 : 18 }
        Row {
            visible: !card.multiProjectile
            width: 530
            height: visible ? 85 : 0
            spacing: 6
            Repeater {
                model: card.multiProjectile ? 0 : 6
                delegate: AmmoRating {
                    width: (530 - 5 * 6) / 6
                    height: 85
                    rating: (card.stats.ratings && card.stats.ratings.length > index)
                        ? Number(card.stats.ratings[index]) : -1
                }
            }
        }
    }
}
