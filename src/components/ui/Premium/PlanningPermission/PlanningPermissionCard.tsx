import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { MultiplePlanningApplication } from "@/types/premiumStreetData";
import { capitaliseFirstLetterAndCleanString } from "@/utils/text";
import React from "react";
import { Cell, Label, Pie, PieChart } from "recharts";

interface PlanningPermissionCardProps {
    planningPermissionData: MultiplePlanningApplication[] | null | undefined;
}

const PlanningPermissionCard: React.FC<PlanningPermissionCardProps> = ({ planningPermissionData }) => {

    // Compute frequency counts for planning permissions, grouping by the "dataset" field
    const typeCounts: Record<string, number> = {};
    applications.forEach((app) => {
        const type = app.dataset?.toLowerCase() || "unknown";
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Convert the counts into an array and sort in descending order
    const entries = Object.entries(typeCounts);
    const sortedEntries = entries.sort(([, countA], [, countB]) => countB - countA);
    const topEntries = sortedEntries.slice(0, 5);

    type ChartDataItem = {
        name: string;
        count: number;
        fill: string;
    };

    const formattedChartData: ChartDataItem[] = topEntries.map(([name, count]) => ({
        name: capitaliseFirstLetterAndCleanString(name),
        count,
        fill: "", // placeholder for the colour, to be filled below
    }));

    // Define a default set of colours
    const colours = [
        "hsl(200, 70%, 50%)",
        "hsl(150, 70%, 50%)",
        "hsl(100, 70%, 50%)",
        "hsl(50, 70%, 50%)",
        "hsl(300, 70%, 50%)",
    ];

    const chartData: ChartDataItem[] = formattedChartData.map((data, index) => ({
        ...data,
        fill: colours[index % colours.length],
    }));

    // Create a chart configuration object similar to the CrimePieChart
    const chartConfig = Object.fromEntries(
        chartData.map((item) => [item.name.toLowerCase(), { label: item.name, color: item.fill }])
    );

    return (
        <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
                <CardTitle className="text-md font-bold">Planning Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[200px]">
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    hideLabel
                                    formatter={(value, name, item) => {
                                        const percentage = ((value as number / totalCount) * 100).toFixed(1);
                                        const color = item.payload.fill;
                                        return (
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="inline-block w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: color }}
                                                ></span>
                                                <span>{name}</span>
                                                <span className="ml-2">{percentage}%</span>
                                            </div>
                                        );
                                    }}
                                />
                            }
                        />
                        <Pie
                            data={chartData}
                            dataKey="count"
                            nameKey="name"
                            innerRadius={60}
                            strokeWidth={5}
                        >
                            <Label
                                content={({ viewBox }) => {
                                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                        return (
                                            <text
                                                x={viewBox.cx}
                                                y={viewBox.cy}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                            >
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    className="fill-foreground text-2xl font-bold"
                                                >
                                                    {totalCount.toLocaleString()}
                                                </tspan>
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={(viewBox.cy || 0) + 24}
                                                    className="fill-muted-foreground"
                                                >
                                                    Total permissions
                                                </tspan>
                                            </text>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>
                <ul className="mt-4 text-sm">
                    {chartData.map(({ name, count }) => (
                        <li key={name} className="mb-1">
                            <span className="font-bold">{capitaliseFirstLetterAndCleanString(name)}</span>:{" "}
                            {count} occurrence{count > 1 ? "s" : ""} – {datasetExplanations[name] || "No explanation available"}
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
};

export default PlanningPermissionCard;