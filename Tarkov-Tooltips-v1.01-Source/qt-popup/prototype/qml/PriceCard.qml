import QtQuick
import QtQuick.Layouts

Rectangle {
    id: card
    property var record: ({})
    property var options: ({})
    readonly property var prices: record.prices || ({})
    readonly property var trader: prices.trader || ({})
    readonly property var questTasks: record.tasks || []
    readonly property bool showName: options.showItemName === true || record.unmatched === true
    readonly property bool showDiagnostics: options.showOcrDiagnostics === true
    readonly property color textColor: "#e4e1d6"

    color: options.popupBackground || "#080909"
    border.color: options.popupBorder || "#59605a"
    // Native-edge border is drawn at full resolution by Popup.qml.
    border.width: 0
    radius: 0
    implicitWidth: Math.ceil(Math.min(540, body.implicitWidth + 14))
    // Price/trader-only popup: add 2 rendered pixels below the trader row
    // relative to v1.01.4, without changing other popup layout.
    // Quest-containing and unmatched popups retain their original padding.
    implicitHeight: Math.ceil(body.implicitHeight +
                              (record.unmatched !== true && questTasks.length === 0 ? 12 : 14))

    TextMetrics {
        id: nameMeasure
        font.family: "Bender"
        font.weight: Font.Light
        font.pixelSize: 15
        text: nameText.text
    }
    TextMetrics {
        id: diagnosticsMeasure
        font.family: "Bender"
        font.pixelSize: 11
        text: diagnosticsText.text
    }

    Column {
        id: body
        x: 7; y: 7
        spacing: 0
        Text {
            id: nameText
            visible: card.showName
            text: record.unmatched ? "No database match" : String(record.name || "")
            color: card.textColor
            font.family: "Bender"
            font.weight: Font.Light
            font.pixelSize: 15
            wrapMode: Text.WrapAnywhere
            width: Math.min(510, Math.max(1, Math.ceil(nameMeasure.advanceWidth) + 2))
            height: visible ? implicitHeight : 0
        }
        Text {
            id: diagnosticsText
            visible: card.showDiagnostics
            text: "OCR: " + String(record.ocrText || "(empty)") +
                  (typeof record.ocrMs === "number" ? " (" + record.ocrMs + " ms)" : "")
            color: "#adcdbd"
            font.family: "Bender"
            font.pixelSize: 11
            width: Math.min(510, Math.max(1, Math.ceil(diagnosticsMeasure.advanceWidth) + 2))
            wrapMode: Text.WrapAnywhere
            height: visible ? implicitHeight : 0
        }
        Row {
            visible: record.unmatched !== true && record.availableOnFleaMarket === true
            height: visible ? implicitHeight : 0
            spacing: 0
            Text {
                text: "₽"
                color: "#abd61c"
                font.family: "Nunito"
                font.pixelSize: 14
            }
            Text {
                color: "#abd61c"
                text: String(Math.min(Number(prices.latest || 0), Number(prices.avgDay || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                font.family: "Bender"
                font.pixelSize: 14
                font.weight: card.options.popupPriceBold === false ? Font.Light : Font.Bold
            }
        }
        // Use the same gap as the 7px bottom edge padding.
        // No gap if the flea price row is absent.
        Item {
            visible: record.unmatched !== true && record.availableOnFleaMarket === true
            width: 0
            height: visible ? 7 : 0
        }
        Row {
            visible: record.unmatched !== true
            height: visible ? implicitHeight : 0
            spacing: 5
            // Portraits originate from the user-provided trader-icon archive.
            readonly property string normalizedTrader: String(trader.name || "").trim().toLowerCase()
            readonly property var knownTraders: ({
                "prapor":"prapor", "therapist":"therapist",
                "skier":"skier", "peacekeeper":"peacekeeper",
                "mechanic":"mechanic", "ragman":"ragman",
                "jaeger":"jaeger", "ref":"ref"
            })
            readonly property string portraitKey: knownTraders[normalizedTrader] || ""
            Image {
                visible: parent.portraitKey.length > 0
                width: visible ? 16 : 0
                height: 16
                sourceSize.width: 48
                sourceSize.height: 48
                source: visible ? "../assets/traders/" + parent.portraitKey + "-portrait.png" : ""
                fillMode: Image.PreserveAspectFit
                asynchronous: false
                smooth: true
            }
            Text {
                visible: parent.portraitKey.length === 0
                text: trader.name && trader.name !== "N/A" ? String(trader.name) : "Trader unknown"
                color: card.textColor
                font.family: "Bender"
                font.pixelSize: 14
            }
            Text {
                visible: Boolean(trader.name && trader.name !== "N/A")
                text: parent.normalizedTrader === "peacekeeper" ? "$" : "₽"
                color: card.textColor
                font.family: "Nunito"
                font.pixelSize: 14
                font.weight: Font.Bold
            }
            // Canvas-drawn, not an embedded image: visually recreates the
            // swap-style reference provided by the user.
            Canvas {
                visible: record.barterUsed === true
                width: visible ? 17 : 0
                height: 16
                onPaint: {
                    var ctx = getContext("2d")
                    ctx.clearRect(0, 0, width, height)
                    ctx.strokeStyle = "#afc0bf"
                    ctx.fillStyle = "#afc0bf"
                    ctx.lineWidth = 2.2
                    ctx.lineCap = "round"
                    // Two opposing hooked arrows suggesting a barter/exchange.
                    ctx.beginPath()
                    ctx.moveTo(3.5, 5)
                    ctx.lineTo(12, 5)
                    ctx.stroke()
                    ctx.beginPath()
                    ctx.moveTo(9.3, 2)
                    ctx.lineTo(13.4, 5)
                    ctx.lineTo(9.3, 8)
                    ctx.fill()
                    ctx.beginPath()
                    ctx.moveTo(13.5, 11)
                    ctx.lineTo(5, 11)
                    ctx.stroke()
                    ctx.beginPath()
                    ctx.moveTo(7.7, 8)
                    ctx.lineTo(3.6, 11)
                    ctx.lineTo(7.7, 14)
                    ctx.fill()
                }
            }
        }
        Grid {
            id: taskGrid
            columns: questTasks.length > 20 ? 3 : (questTasks.length > 10 ? 2 : 1)
            rows: questTasks.length > 10
                ? Math.ceil(questTasks.length / columns) : Math.max(1, questTasks.length)
            flow: Grid.TopToBottom
            columnSpacing: 12
            rowSpacing: 0
            Repeater {
                model: card.questTasks
                delegate: Row {
                    spacing: 2
                    Text {
                        text: "✓"
                        color: modelData.inRaid ? "#e3ae00" : card.textColor
                        font.family: "Nunito"
                        font.pixelSize: 12
                    }
                    Text {
                        text: String(modelData.count || 1) + " - "
                        color: card.textColor
                        font.family: "Bender"
                        font.pixelSize: 14
                        font.weight: Font.Bold
                    }
                    Text {
                        text: String(modelData.task || "")
                        color: card.textColor
                        font.family: "Bender"
                        font.pixelSize: 14
                    }
                }
            }
        }
    }
}
