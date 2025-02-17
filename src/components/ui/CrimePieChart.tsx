import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { capitaliseFirstLetterAndCleanString } from "@/utils/text";
import { TrendingDown, TrendingUp } from "lucide-react";
import React from "react";
import { Label, Pie, PieChart } from "recharts";

interface ChartDataItem {
    crime: string;
    count: number;
    fill: string;
}

export interface CrimePieChartProps {
    crimeSummary: Record<string, number>;
    totalCrimes?: number;
    trendingPercentageOver6Months: number;
}

export function CrimePieChart({ crimeSummary, totalCrimes, trendingPercentageOver6Months }: CrimePieChartProps) {
    // Check if there are no crimes based on totalCrimes or the sum of crimeSummary values
    const totalCrimeCount = totalCrimes ?? Object.values(crimeSummary).reduce((sum, count) => sum + count, 0);
    if (totalCrimeCount === 0) {
        return (
            <Card className="flex flex-col">
                <CardHeader className="items-center pb-0">
                    <CardTitle className="text-md font-bold">No crimes recorded</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">There have been no crimes committed in the last 6 months.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    // Convert the crimeSummary object into an array and sort by count (descending)
    const entries = Object.entries(crimeSummary);
    const sortedEntries = entries.sort(([, countA], [, countB]) => countB - countA);
    const top5Entries = sortedEntries.slice(0, 5);

    const formattedChartData: ChartDataItem[] = top5Entries.map(([crime, count]) => ({
        crime: capitaliseFirstLetterAndCleanString(crime),
        count,
        fill: "",
    }));

    // Define a default set of colours to be assigned to each slice
    const colors = [
        "hsl(200, 70%, 50%)",
        "hsl(150, 70%, 50%)",
        "hsl(100, 70%, 50%)",
        "hsl(50, 70%, 50%)",
        "hsl(300, 70%, 50%)",
    ];
    const chartData: ChartDataItem[] = formattedChartData.map((data, index) => ({
        ...data,
        fill: colors[index % colors.length],
    }));

    const chartConfig = Object.fromEntries(
        chartData.map((item) => [
            item.crime.toLowerCase(),
            { label: item.crime, color: item.fill },
        ])
    );

    const trendDirectionUpOrDownText = trendingPercentageOver6Months >= 0 ? "up" : "down";
    const trendPercentage = Math.abs(trendingPercentageOver6Months).toFixed(1);
    const TrendIcon = trendingPercentageOver6Months >= 0 ? TrendingUp : TrendingDown;

    return (
        <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
                <CardTitle className="text-md font-bold">Top 5 crimes over last 6 months</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Within 1 mile of this location</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[200px]"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    hideLabel
                                    formatter={(value, name, item) => {
                                        const percentage = ((value as number / totalCrimeCount) * 100).toFixed(1);
                                        const color = item.payload.fill;
                                        return (
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="inline-block w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: color }}
                                                ></span> {/* Colour swab */}
                                                <span>{name}</span>
                                                <span className="ml-2">{percentage}%</span>
                                            </div>
                                        );
                                    }} />
                            }
                        />
                        <Pie
                            data={chartData}
                            dataKey="count"
                            nameKey="crime"
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
                                                dominantBaseline="low"
                                            >
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    className="fill-foreground text-2xl font-bold"
                                                >
                                                    {totalCrimes?.toLocaleString()}
                                                </tspan>
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={(viewBox.cy || 0) + 24}
                                                    className="fill-muted-foreground"
                                                >
                                                    Total crimes
                                                </tspan>
                                            </text>
                                        );
                                    }
                                }}
                            />
                        </Pie>
                    </PieChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-xs">
                <div className="flex items-center gap-2 font-medium leading-none text-xs">
                    Trending {trendDirectionUpOrDownText} by {trendPercentage}%<TrendIcon className="h-4 w-4" />
                </div>
            </CardFooter>
        </Card>
    );
}