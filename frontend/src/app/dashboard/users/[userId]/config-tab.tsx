type UserConfigTabProps = {
    userId: string;
};

export default function UserConfigTab({ userId }: UserConfigTabProps) {
    return (
        <div>
            <h2>User Configuration</h2>
            <p>Configuration settings for user ID: {userId}</p>
            {/* Add more configuration options here */}
        </div>
    );
}
