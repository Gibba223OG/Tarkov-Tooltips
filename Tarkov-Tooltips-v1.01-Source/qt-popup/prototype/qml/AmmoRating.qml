import QtQuick

Item {
    id: ratingItem
    property int rating: -1
    readonly property var layoutData: ({
        "0": { count: 14, solid: 14, color: "#D20603" },
        "1": { count: 14, solid: 13, color: "#DF3A0C" },
        "2": { count: 13, solid: 9,  color: "#ED6B18" },
        "3": { count: 9,  solid: 5,  color: "#FC9D26" },
        "4": { count: 5,  solid: 3,  color: "#C1B937" },
        "5": { count: 3,  solid: 1,  color: "#86D54D" },
        "6": { count: 1,  solid: 1,  color: "#45F165" }
    })
    readonly property var entry: layoutData[String(rating)] || { count: 0, solid: 0, color: "#ffffff" }
    readonly property int total: entry.count
    readonly property int perRow: Math.min(7, total)
    readonly property real bulletWidth: perRow >= 7 ? 9.4 : perRow >= 5 ? 12.5 : perRow >= 4 ? 14 : perRow >= 3 ? 16 : 19
    readonly property real bulletHeight: perRow >= 7 ? 31 : perRow >= 5 ? 39 : perRow >= 4 ? 42 : perRow >= 3 ? 49 : 56
    readonly property real bulletGap: perRow >= 7 ? 1.8 : perRow >= 5 ? 2 : 3
    readonly property bool twoRows: total > 7

    Column {
        anchors.centerIn: parent
        spacing: 3
        Row {
            spacing: ratingItem.bulletGap
            Repeater {
                model: Math.min(7, ratingItem.total)
                delegate: BulletIcon {
                    width: ratingItem.bulletWidth
                    height: ratingItem.bulletHeight
                    tint: ratingItem.entry.color
                    opacity: index < ratingItem.entry.solid ? 1 : 0.5
                }
            }
        }
        Row {
            visible: ratingItem.twoRows
            height: visible ? implicitHeight : 0
            spacing: ratingItem.bulletGap
            Repeater {
                model: Math.max(0, ratingItem.total - 7)
                delegate: BulletIcon {
                    width: ratingItem.bulletWidth
                    height: ratingItem.bulletHeight
                    tint: ratingItem.entry.color
                    opacity: index + 7 < ratingItem.entry.solid ? 1 : 0.5
                }
            }
        }
    }
}
