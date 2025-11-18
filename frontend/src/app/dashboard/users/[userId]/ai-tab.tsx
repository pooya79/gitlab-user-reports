type AiTabProps = {
    userId: string;
};

export default function AiTab({ userId }: AiTabProps) {
    return (
        <div>
            <h2>AI Analysis</h2>
            <p>AI analysis settings for user ID: {userId}</p>
            {/* Add more AI analysis options here */}
        </div>
    );
}
