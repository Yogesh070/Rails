import React from 'react'
import WorkSpaceLayout from '../../../layout/WorkspaceLayout';
import { Avatar, Button, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/es/table';
import Image from 'next/image';
import CustomDivider from '../../../components/CustomDivider/CustomDivider';
import { useWorkspaceStore } from '../../../store/workspace.store';

import { CloseOutlined } from '@ant-design/icons';

type Member = {
  image: string | null;
  id: string;
  name: string;
}

const { Title, Paragraph, Text } = Typography;
const Members = () => {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const columns: ColumnsType<Member> = [
    {
      title: 'User',
      render: (_, record) => {
        return <div className="flex gap-1-2">
          <Avatar size="small"> {record.image ? <Image src={record.image || '/logo.svg'} width={24} height={24} alt={record.id} style={{ objectFit: "contain" }} /> : record.name}</Avatar>
          <Text>{record.name}</Text>
        </div>
      }
    },
    {
      title: 'Actions',
      render: (_, record) => {
        return <Button icon={<CloseOutlined />}>{workspace?.createdById === record.id ? 'Leave' : 'Remove'}</Button>
      }
    },
  ];
  return (
    <div>
      <Title level={5} className="m-0">  Workspace members ({workspace?.members.length})</Title>
      <Paragraph className="m-0">Workspace members can view and join all Workspace visible projects and create new projects in the Workspace.</Paragraph>
      <CustomDivider className='my-4' />
      <div className="flex gap-1 items-center justify-between">
        <div>
          <Title level={5} className="m-0">Invite members to join you</Title>
          <Paragraph className="m-0">Anyone with an invite link can join this Free Workspace. You can also disable and create a new invite link for this Workspace at any time.</Paragraph>
        </div>
        <Button >Invite With Link</Button>
      </div>
      <Table columns={columns} dataSource={workspace?.members} size="small"
        className='mt-4'
        rowKey="id"
      />
    </div>
  )
}
Members.getLayout = (page: React.ReactElement) => {
  return <WorkSpaceLayout>{page}</WorkSpaceLayout>;
};

export default Members