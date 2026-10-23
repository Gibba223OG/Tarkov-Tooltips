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
    implicitHeight: Math.ceil(body.implicitHeight + 14)

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
        Row {
            visible: record.unmatched !== true
            height: visible ? implicitHeight : 0
            Text {
                visible: Boolean(trader.name && trader.name !== "N/A")
                text: trader.name ? String(trader.name).charAt(0) : ""
                color: card.textColor
                font.family: "Bender"
                font.weight: Font.Bold
                font.pixelSize: 14
            }
            Text {
                visible: Boolean(trader.name && trader.name !== "N/A")
                text: "₽"
                color: card.textColor
                font.family: "Nunito"
                font.pixelSize: 14
            }
            Text {
                visible: !(trader.name && trader.name !== "N/A")
                text: "Trader unknown"
                color: card.textColor
                font.family: "Bender"
                font.pixelSize: 14
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
