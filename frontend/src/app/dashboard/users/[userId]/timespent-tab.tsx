type TimespentTabProps = {
    userId: string;
};

export default function TimespentTab({ userId }: TimespentTabProps) {
    return (
        <div>
            <h2>Timespent Dashboard</h2>
            <p>Timespent details for user ID: {userId}</p>
        </div>
    );
}
